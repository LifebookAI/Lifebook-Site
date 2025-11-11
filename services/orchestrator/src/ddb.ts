import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.LF_ORCH_TABLE || "lifebook-orchestrator-jobs";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function recordRun(run: { pk: string; sk: string; status: string; summary?: string; logs?: string[]; idemKey?: string }) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: run }));
}
export async function getByIdemKey(idemKey: string) {
  // PK: "IDEM#<key>", SK: fixed
  const key = { pk: `IDEM#${idemKey}`, sk: "LATEST" };
  const got = await ddb.send(new GetCommand({ TableName: TABLE, Key: key }));
  return got.Item ?? null;
}
export async function saveIdem(idemKey: string, runId: string, jobId: string) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: `IDEM#${idemKey}`, sk: "LATEST", runId, jobId, ts: Date.now() }
  }));
}