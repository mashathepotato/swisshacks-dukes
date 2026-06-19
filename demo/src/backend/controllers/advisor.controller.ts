import { Request, Response } from "express";
import { getStore, Store } from "../store/store";
import { computeDrift } from "../engine/drift";
import { proposeSwap } from "../engine/swap";
import { buildAlerts } from "../engine/alerts";
import { rankInbox, summarizeClient } from "../engine/inbox";
import { draftMessage } from "../agents/messageAgent";
import { PhoeniqsService } from "../services/phoeniqs.service";
import { Trace, Voice } from "../../shared/domain";

const phoeniqs = new PhoeniqsService();

// Shared alert computation for a single client; returns [] for unknown/unwired ids.
function clientAlerts(s: Store, id: string): Trace[] {
  const dna = s.getDna(id);
  if (!dna) return [];
  const holdings = s.getHoldings(id);
  const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
  return buildAlerts({ dna, holdings, news: s.getNews(id), cio: s.getCio(), drift });
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
