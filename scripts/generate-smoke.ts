// Capture the actual production interpreter request for the native real-model smoke test.
import { writeFileSync } from 'node:fs';
import { initialScenario } from '../src/core/scenario.ts';
import { LocalTextProvider } from '../src/ai/local.ts';
const ai=new LocalTextProvider(async request=>{
  writeFileSync(new URL('../tests/fixtures/interpret-request.json',import.meta.url),JSON.stringify(request,null,2)+'\n');
  return '{"summary":"fixture","operations":[]}';
});
await ai.interpretPlayerAction('장비에게 병사 3천을 맡겨 한중으로 보내고 나는 성도에 남는다.',initialScenario());
