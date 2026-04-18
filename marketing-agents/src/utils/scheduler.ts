import cron from 'node-cron';
import logger from './logger';

export interface ScheduledTask {
  name: string;
  expression: string;
  handler: () => Promise<void>;
}

export function scheduleTask(task: ScheduledTask): cron.ScheduledTask {
  logger.info(`Agendando tarefa: ${task.name} [${task.expression}]`);

  return cron.schedule(task.expression, async () => {
    logger.info(`▶ Iniciando tarefa agendada: ${task.name}`);
    const start = Date.now();
    try {
      await task.handler();
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      logger.info(`✓ Tarefa concluída: ${task.name} (${elapsed}s)`);
    } catch (err) {
      logger.error(`✗ Erro na tarefa ${task.name}:`, err);
    }
  });
}

export function getNextRun(expression: string): string {
  // Simple human-readable description of cron expressions used in this project
  const descriptions: Record<string, string> = {
    '0 9 * * 1,3,5': 'Seg/Qua/Sex às 09:00',
    '0 8 * * 1': 'Segunda-feira às 08:00',
    '0 7 1 * *': 'Dia 1 de cada mês às 07:00',
  };
  return descriptions[expression] ?? expression;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`Tentativa ${attempt}/${retries} falhou. Aguardando ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
