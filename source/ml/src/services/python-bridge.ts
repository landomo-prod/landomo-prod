import { spawn } from 'child_process';
import { config } from '../config';
import { modelLog } from '../logger';
import { PredictionTimeoutError } from '../middleware/error-handler';

const PREDICTION_TIMEOUT_MS = 5000;

export interface PythonPredictionResult {
  predicted_price: number;
  confidence_lower: number;
  confidence_upper: number;
  feature_importances?: Record<string, number>;
}

export async function callPythonPredict(
  modelPath: string,
  features: Record<string, unknown>
): Promise<PythonPredictionResult> {
  const scriptPath = `${process.cwd()}/ml/predict.py`;

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.path, [
      scriptPath,
      '--model', modelPath,
      '--features', JSON.stringify(features),
    ]);

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new PredictionTimeoutError());
    }, PREDICTION_TIMEOUT_MS);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        modelLog.error({ code, stderr, scriptPath }, 'Python prediction script failed');
        reject(new Error(`Python prediction failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        // predict.py outputs __RESULT_JSON__:{json} - extract the JSON part
        const lines = stdout.trim().split('\n');
        let jsonStr = '';
        for (const line of lines) {
          if (line.startsWith('__RESULT_JSON__:')) {
            jsonStr = line.substring('__RESULT_JSON__:'.length);
            break;
          }
        }
        if (!jsonStr) {
          // Fallback: try parsing entire stdout as JSON
          jsonStr = stdout.trim();
        }
        const result = JSON.parse(jsonStr) as PythonPredictionResult;
        resolve(result);
      } catch {
        modelLog.error({ stdout }, 'Failed to parse Python prediction output');
        reject(new Error('Failed to parse prediction result'));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      modelLog.error({ err }, 'Failed to spawn Python process');
      reject(err);
    });
  });
}

export async function callPythonTrain(
  country: string,
  category: string,
  outputPath: string,
  dbConnectionString: string
): Promise<{ modelPath: string; metricsPath: string; metrics: Record<string, number> }> {
  const scriptPath = `${process.cwd()}/ml/train_model.py`;

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.path, [
      scriptPath,
      '--country', country,
      '--category', category,
      '--output', outputPath,
      '--db-url', dbConnectionString,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        modelLog.error({ code, stderr }, 'Python training script failed');
        reject(new Error(`Training failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const lines = stdout.trim().split('\n');
        let jsonStr = '';
        for (const line of lines) {
          if (line.startsWith('__RESULT_JSON__:')) {
            jsonStr = line.substring('__RESULT_JSON__:'.length);
            break;
          }
        }
        if (!jsonStr) {
          jsonStr = stdout.trim();
        }
        const result = JSON.parse(jsonStr);
        resolve(result);
      } catch {
        modelLog.error({ stdout }, 'Failed to parse training output');
        reject(new Error('Failed to parse training result'));
      }
    });

    proc.on('error', (err) => {
      modelLog.error({ err }, 'Failed to spawn Python training process');
      reject(err);
    });
  });
}
