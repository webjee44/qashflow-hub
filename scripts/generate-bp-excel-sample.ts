import { computeBPModel } from '@/features/business-plan/engine/computeBPModel';
import { minimalBPInput } from '@/features/business-plan/engine/__tests__/__fixtures__/minimal-bp';
import { buildBPWorkbook, buildExportFilename } from '@/features/business-plan/export/excel/buildBPWorkbook';
import { writeFileSync } from 'fs';

const model = computeBPModel(minimalBPInput);
const meta = {
  companyName: 'Cloud Vapor (démo)',
  companyId: 'demo-company',
  businessPlanId: 'demo-bp',
  exportedAt: new Date(),
  currency: 'EUR',
};
const wb = buildBPWorkbook(model, minimalBPInput, meta);
const buf = await wb.xlsx.writeBuffer();
const filename = `/mnt/documents/${buildExportFilename(meta.companyName, meta.exportedAt)}`;
writeFileSync(filename, Buffer.from(buf));
console.log('Wrote', filename, 'size=', buf.byteLength);
