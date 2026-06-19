import { Request, Response } from "express";
import { getStore } from "../store/store";
import { computeDrift } from "../engine/drift";
import { proposeSwap } from "../engine/swap";
import { buildAlerts } from "../engine/alerts";
import { draftMessage } from "../agents/messageAgent";
import { PhoeniqsService } from "../services/phoeniqs.service";
import { Voice } from "../../shared/domain";

const phoeniqs = new PhoeniqsService();

export class AdvisorController {
  listClients(_req: Request, res: Response) {
    res.json({ success: true, data: getStore().listClients() });
  }

  getClient(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const holdings = s.getHoldings(id);
    const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
    res.json({ success: true, data: { dna, holdings, drift, thread: s.getThread(id) } });
  }

  getAlerts(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const holdings = s.getHoldings(id);
    const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
    const traces = buildAlerts({ dna, holdings, news: s.getNews(id), cio: s.getCio(), drift });
    res.json({ success: true, data: traces });
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
    const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
    const alerts = buildAlerts({
      dna, holdings, news: s.getNews(clientId),
      cio: s.getCio(), drift,
    });
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
