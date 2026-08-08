import { Router } from 'express';
import { PgGraphRepository } from '../repositories/pg-graph.repository.js';
import { GraphService } from '../services/graph.service.js';
import { GraphController } from '../controllers/graph.controller.js';

const router = Router();

const graphRepository = new PgGraphRepository();
const graphService = new GraphService(graphRepository);
const graphController = new GraphController(graphService);

router.post('/query', (req, res, next) => graphController.query(req, res, next));

export default router;
