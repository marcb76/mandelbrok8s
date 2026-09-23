// /src/validators/globalConfig.validator.ts - Input validation middleware for global configuration updates

// Import required modules
import { body } from 'express-validator';
import { parseValidationResults } from './validator';
import { Request, Response, NextFunction } from 'express';




// PUT / PATCH /api/v1/global_config
export const validateUpdateGlobalConfig = [
  // Worker configuration validation
  body('worker.port', 'Please provide a valid worker port between 1 and 65535')
    .optional({ values: 'undefined' })
    .isInt({ min: 1, max: 65535 })
    .bail(),
  body('worker.pollIntervalMs', 'Please provide a valid pollIntervalMs greater than or equal to 100')
    .optional({ values: 'undefined' })
    .isInt({ gt: 99 })
    .bail(),
  body('worker.taskTimeoutMs', 'Please provide a valid taskTimeoutMs greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('worker.tasksConcurrency', 'Please provide a valid tasksConcurrency greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),

  // Fractal defaults validation
  body('fractalDefaults.iterations', 'Please provide valid iterations greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('fractalDefaults.resolution.width', 'Please provide a valid resolution width greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('fractalDefaults.resolution.height', 'Please provide a valid resolution height greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('fractalDefaults.zoom', 'Please provide a valid zoom value greater than 0')
    .optional({ values: 'undefined' })
    .isFloat({ gt: 0 })
    .bail(),
  body('fractalDefaults.center', 'Please provide a valid center coordinate array of 2 numbers')
    .optional({ values: 'undefined' })
    .isArray({ min: 2, max: 2 })
    .bail(),
  body('fractalDefaults.center.*', 'Center coordinates must be valid numbers')
    .optional({ values: 'undefined' })
    .isNumeric()
    .bail(),

  // K8s HPA configuration validation
  body('k8sHpa.minReplicas', 'Please provide a valid minReplicas greater than or equal to 1')
    .optional({ values: 'undefined' })
    .isInt({ min: 1 })
    .bail(),
  body('k8sHpa.maxReplicas', 'Please provide a valid maxReplicas greater than or equal to 1')
    .optional({ values: 'undefined' })
    .isInt({ min: 1 })
    .bail(),
  body('k8sHpa.cpuUtilizationPercentage', 'Please provide a valid cpuUtilizationPercentage between 1 and 100')
    .optional({ values: 'undefined' })
    .isInt({ min: 1, max: 100 })
    .bail(),
  body('k8sHpa.scaleDownStabilizationWindowSeconds', 'Please provide a valid scaleDownStabilizationWindowSeconds greater than or equal to 0')
    .optional({ values: 'undefined' })
    .isInt({ min: 0 })
    .bail(),

  // Parse validation results middleware
  (req: Request, res: Response, next: NextFunction) => parseValidationResults(req, res, next),
];
