// /src/validators/validator.ts - Helper to parse and handle express-validator results

// Import required modules
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';




// Parse validation results and return 400 if validation fails
export function parseValidationResults(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  next();
}
