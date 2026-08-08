import { GraphService } from '../services/graph.service.js';
import { Request, Response, NextFunction } from 'express';

export class GraphController {
  constructor(private graphService: GraphService) {}

  async query(req: Request, res: Response, next: NextFunction) {
    try {
      const { rootWordId, depth, include } = req.body;
      const result = await this.graphService.query({ rootWordId, depth, include });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
