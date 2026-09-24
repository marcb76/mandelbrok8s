// /src/validators/task.validator.ts - Validators for task management endpoints

// Import required modules
import { body, param } from 'express-validator';
import { parseValidationResults } from './validator';
import { Request, Response, NextFunction } from 'express';




// POST /api/v1/tasks
export const validateCreateTask = [
  body('count', 'Please provide a valid count between 1 and 1000')
    .optional({ values: 'undefined' })
    .isInt({ min: 1, max: 1000 })
    .bail(),
  body('randomizeRender', 'Please provide a valid boolean value for randomizeRender')
    .optional({ values: 'undefined' })
    .isBoolean()
    .bail(),
  body('renderConfig', 'Please provide a valid renderConfig object')
    .optional({ values: 'undefined' })
    .isObject()
    .bail(),

  // RenderConfig nested properties validation
  body('renderConfig.iterations', 'Please provide valid iterations greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('renderConfig.resolution.width', 'Please provide a valid resolution width greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('renderConfig.resolution.height', 'Please provide a valid resolution height greater than 0')
    .optional({ values: 'undefined' })
    .isInt({ gt: 0 })
    .bail(),
  body('renderConfig.zoom', 'Please provide a valid zoom value greater than 0')
    .optional({ values: 'undefined' })
    .isFloat({ gt: 0 })
    .bail(),
  body('renderConfig.center', 'Please provide a valid center coordinate array of 2 numbers')
    .optional({ values: 'undefined' })
    .isArray({ min: 2, max: 2 })
    .bail(),
  body('renderConfig.center.*', 'Center coordinates must be valid numbers')
    .optional({ values: 'undefined' })
    .isNumeric()
    .bail(),

  (req: Request, res: Response, next: NextFunction) => parseValidationResults(req, res, next),
];




// GET /api/v1/tasks/:id, GET /api/v1/tasks/:id/image, and DELETE /api/v1/tasks/:id
export const validateTaskId = [
  param('id', 'Please provide a valid task id')
    .isString()
    .bail()
    .notEmpty()
    .bail()
    .trim()
    .escape()
    .bail(),
  (req: Request, res: Response, next: NextFunction) => parseValidationResults(req, res, next),
];