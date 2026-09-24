// /src/controllers/globalConfig.controller.ts - Controller for global configuration management endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Request, Response } from 'express';
import { getDB, globalConfigId } from '../config/database';




// Helper function to flatten nested objects into MongoDB dot-notation keys
function flattenObject(obj: any, prefix = '', res: { [key: string]: any } = {}): { [key: string]: any } {
  for (const key of Object.keys(obj)) {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      flattenObject(obj[key], `${prefix}${key}.`, res);
    } else {
      res[`${prefix}${key}`] = obj[key];
    }
  }
  return res;
}




// GlobalConfigController
export class GlobalConfigController {
  // GET /api/v1/global_config - Fetches the active operational defaults and runtime configuration
  public static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      // Fetch the global configuration document from the database
      const { globalConfigCollection } = getDB();
      const config = await globalConfigCollection.findOne({ _id: globalConfigId as any });
      if (!config) {
        // Respond with a 404 error if the global configuration is not found
        res.status(404).json({
          status: 'error',
          message: 'Global configuration not found'
        });
        return;
      }

      // Respond with the fetched global configuration
      res.status(200).json({
        status: 'success',
        config
      });
    } catch (err: any) {
      // Log the error and respond with a 500 status code
      console.error('[CONFIG_CTRL] Error fetching global configuration:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error while fetching global configuration',
        details: err.message
      });
    }
  }




  // PATCH /api/v1/global_config - Dynamically updates operational parameters (supports partial updates via dot-notation)
  public static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      // Fetch the global configuration collection from the database
      const { globalConfigCollection } = getDB();

      // Flatten the request body to prevent overwriting nested sibling properties in MongoDB
      const flattenedBody = flattenObject(req.body);
      const updateData = { ...flattenedBody, updatedAt: new Date() };

      // Update the global configuration document in the database using dot notation
      const result = await globalConfigCollection.updateOne(
        { _id: globalConfigId as any },
        { $set: updateData },
        { upsert: true }
      );

      // Log the update and respond with updated global configuration status
      console.log('[CONFIG_CTRL] Global configuration updated successfully.');
      res.status(200).json({
        status: 'success',
        message: 'Global configuration updated successfully',
        result
      });
    } catch (err: any) {
      // Log the error and respond with a 500 status code
      console.error('[CONFIG_CTRL] Error updating global configuration:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error while updating global configuration',
        details: err.message
      });
    }
  }
}