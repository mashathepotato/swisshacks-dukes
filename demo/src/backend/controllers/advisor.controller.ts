import { Request, Response } from "express";
import { getStore, Store } from "../store/store";
import { computeDrift } from "../engine/drift";
import { proposeSwap } from "../engine/swap";
import { buildAlerts } from "../engine/alerts";
import { rankInbox, summarizeClient } from "../engine/inbox";
import { simulateSwap } from "../engine/simulate";
import { classifySignal } from "../engine/signals";
import { draftMessage } from "../agents/messageAgent";
import { PhoeniqsService } from "../services/phoeniqs.service";
import { ClientSignal, Trace, Voice } from "../../shared/domain";

const phoeniqs = new PhoeniqsService();

// Shared alert computation for a single client; returns [] for unknown/unwired ids.
// Flagged inbound client messages surface as top-priority ACT traces. NOTE: the
// prepend order below is load-bearing — signal traces must lead so the inbox
// treats a live client message as most urgent.
export function clientAlerts(s: Store, id: string): Trace[] {
  const dna = s.getDna(id);
  if (!dna) return [];
  const holdings = s.getHoldings(id);
  const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
  const base = buildAlerts({ dna, holdings, news: s.getNews(id), cio: s.getCio(), drift });
  const signalTraces: Trace[] = s
    .getSignals(id)
    .filter((sig) => sig.flagged)
    .map((sig) => ({
      id: `client-signal:${sig.id}`,
      claim: `Client message: "${sig.text}"`,
      type: "client-signal",
      confidence: 1,
      severity: "act",
      evidence: [{ kind: "client", sourceId: sig.id, date: sig.receivedAt, quote: sig.text }],
    }));
  return [...signalTraces, ...base];
}

export class AdvisorController {
  listClients(_req: Request, res: Response) {
    res.json({ success: true, data: getStore().listClients() });
  }

  // Priority inbox: every client's most-urgent alert, ranked by severity x value-at-stake.
  inbox(_req: Request, res: Response) {
    const s = getStore();
    const rows = s.listClients().map((c) => summarizeClient(c.id, c.name, c.mandate, clientAlerts(s, c.id)));
    res.json({ success: true, data: rankInbox(rows) });
  }

  getClient(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const holdings = s.getHoldings(id);
    const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
    res.json({ success: true, data: { dna, holdings, drift, thread: s.getThread(id), news: s.getNews(id) } });
  }

  getAlerts(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    if (!s.getDna(id)) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    res.json({ success: true, data: clientAlerts(s, id) });
  }

  // 24/7 client channel: log + classify an inbound message. The AI NEVER replies
  // to the client; it only flags high-priority ones for the RM.
  postInbound(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    if (!s.getDna(id)) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ success: false, error: "empty message" });
    const { flagged, reason } = classifySignal(text);
    const signal: ClientSignal = {
      id: `sig-${Date.now()}`,
      clientId: id,
      text,
      receivedAt: new Date().toISOString(),
      flagged,
      reason,
    };
    s.addSignal(signal);
    res.json({ success: true, data: { logged: true, aiReplied: false, flagged, reason, signal } });
  }

  getSignals(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    if (!s.getDna(id)) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    res.json({ success: true, data: s.getSignals(id) });
  }

  // What-if: run a hypothetical swap through the deterministic engines and report
  // same-sector / CIO-BUY / drift impact / DNA verdict — before the RM proposes it.
  simulate(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const { sellIsin, buyIsin, amountCHF } = req.body as { sellIsin?: string; buyIsin?: string; amountCHF?: number };
    if (!sellIsin || !buyIsin) return res.status(400).json({ success: false, error: "sellIsin and buyIsin are required" });
    const sellResolvesConflict = clientAlerts(s, id).some((a) => a.id === `dna-conflict:${sellIsin}`);
    const result = simulateSwap({
      holdings: s.getHoldings(id), strategies: s.getStrategies(), cio: s.getCio(), dna, mandate: dna.mandate,
      sellIsin, buyIsin, amountCHF: typeof amountCHF === "number" ? amountCHF : undefined, sellResolvesConflict,
    });
    res.json({ success: true, data: result });
  }

  getSwap(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const isin = String(req.query.isin || "");
    const holdings = s.getHoldings(id);
    res.json({ success: true, data: proposeSwap(isin, holdings, s.getCio()) });
  }

  async postMessage(req: Request, res: Response) {
    const s = getStore();
    const { clientId, eventId, voice } = req.body as { clientId: string; eventId: string; voice: Voice };
    const live = req.body.live !== false && req.query.live !== "false";
    const dna = s.getDna(clientId);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const holdings = s.getHoldings(clientId);
    const alerts = clientAlerts(s, clientId);
    const alert = alerts[0];
    // Swap only applies to holding-keyed alerts (dna-conflict / dna-opportunity, id = "type:ISIN").
    // For cio-dna-conflict / client-signal the second segment isn't an ISIN, so proposeSwap
    // returns chosen:null and the draft recommends flagging for RM review instead.
    const swap = alert ? proposeSwap(alert.id.split(":")[1] || "", holdings, s.getCio()) : null;
    const result = await draftMessage(
      { dna, alert, swap, voice, cacheKey: `${clientId}:${eventId}:${voice}` },
      {
        chat: (system, user) => phoeniqs.chat(system, user),
        cache: s.getMessageCache(),
        live: live && phoeniqs.configured,
      }
    );
    res.json({ success: true, data: result });
  }
}
