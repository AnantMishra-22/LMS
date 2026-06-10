"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqs = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const env_1 = require("./env");
const globalForSqs = globalThis;
const sqsClientConfig = {
    region: env_1.env.AWS_REGION,
    ...(env_1.env.SQS_ENDPOINT
        ? {
            endpoint: env_1.env.SQS_ENDPOINT,
            credentials: {
                accessKeyId: 'elasticmq',
                secretAccessKey: 'elasticmq'
            }
        }
        : {})
};
exports.sqs = globalForSqs.sqs ??
    new client_sqs_1.SQSClient(sqsClientConfig);
if (env_1.env.NODE_ENV !== 'production') {
    globalForSqs.sqs = exports.sqs;
}
