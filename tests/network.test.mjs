import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rateLimited} from '../scripts/network.mjs';

test('an explicit quota rejection pauses before retrying',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  let attempts=0;
  const result=rateLimited(async()=>{attempts++;if(attempts===1)throw new Error('Rate limit exceeded: 500 requests per hour');return 'accepted';});
  await Promise.resolve();
  context.mock.timers.tick(299999);
  assert.equal(attempts,1);
  context.mock.timers.tick(1);
  assert.equal(await result,'accepted');
  assert.equal(attempts,2);
});

test('unknown write failures are never blindly resubmitted',async()=>{
  let attempts=0;
  await assert.rejects(rateLimited(async()=>{attempts++;throw new Error('Connection lost after submission');}),/Connection lost/);
  assert.equal(attempts,1);
});
