import {validateDefinition} from '../lib/definition.js';
import {paperTemplate} from '../lib/templates.js';
import {reviewedPaperTemplate} from '../lib/paper-workflow.js';
import {nextAt} from '../lib/scheduler.js';
validateDefinition(paperTemplate());
validateDefinition(reviewedPaperTemplate());
const preview = nextAt({kind:'interval',seconds:60}, Date.now());
if (!Number.isFinite(preview)) throw new Error('HOST_CHECK_FAILED');
console.log('Host checks passed: definition, scheduler and runtime modules are loadable.');
