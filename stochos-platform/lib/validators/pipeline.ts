import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import pipelineSchema from '../schemas/pipeline_schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export const validatePipeline = ajv.compile(pipelineSchema);
