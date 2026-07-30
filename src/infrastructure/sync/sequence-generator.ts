import { ISequenceGenerator } from '../../core/interfaces/sync';
import { SEQUENCE_COLUMNS } from '../../shared/constants/sequence-config';
import { supabase } from '../api/supabase';

export class SequenceGenerator implements ISequenceGenerator {
  async generateNext(_tableName: string, prefix: string): Promise<string> {
    try {
      const colName = SEQUENCE_COLUMNS[_tableName];
      if (!colName) {
        throw new Error(`No sequence column mapping found for table ${_tableName}`);
      }

      const { data, error } = await (supabase
        .from(_tableName)
        .select(colName as any) as any)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNo = 10001;
      if (!error && data && data.length > 0) {
        const record = data[0] as any;
        const val = record[colName] || '';
        const match = val.match(/\d+/);
        if (match) {
          nextNo = parseInt(match[0], 10) + 1;
        }
      }
      return `${prefix}-${nextNo}`;
    } catch (err: any) {
      console.error(`Error generating server sequence: ${err.message}. Using fallback generator.`);
      return `${prefix}-${Math.floor(Math.random() * 900000) + 100000}`;
    }
  }

  generatePending(_tableName: string, prefix: string): string {
    return `PENDING-${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}