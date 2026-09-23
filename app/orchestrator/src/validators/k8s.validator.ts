// /src/validators/k8s.validator.ts - Validators for Kubernetes cluster monitoring endpoints

// Import required modules
import { param } from 'express-validator';
import { parseValidationResults } from './validator';
import { Request, Response, NextFunction } from 'express';




// GET /api/v1/k8s/pods/:name
export const validatePodName = [
  param('name', 'Please provide a valid Kubernetes pod name')
    .isString()
    .bail()
    .notEmpty()
    .bail()
    .trim()
    .escape()
    .bail()
    .matches(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/)
    .withMessage('Pod name must consist of lower case alphanumeric characters, \'-\' or \'.\', and must start and end with an alphanumeric character')
    .bail(),
  (req: Request, res: Response, next: NextFunction) => parseValidationResults(req, res, next),
];