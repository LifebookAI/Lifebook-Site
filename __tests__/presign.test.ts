import { buildPutInput, hexToBase64 } from "@/lib/presign";

test("hexToBase64 validates length", () => {
  expect(() => hexToBase64("abc")).toThrow();
});

test("buildPutInput wires SSE-KMS and checksum", () => {
  const req = { workspaceId:"ws1", fileName:"a.txt", contentType:"text/plain", sha256:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } as any;
  const { key, guid, input } = buildPutInput(req, "lifebook.ai", "arn:aws:kms:xx:acct:key/abc");
  expect(key).toMatch(/^sources\/ws1\/.+\/a\.txt$/);
  expect(guid).toHaveLength(36);
  expect(input.ServerSideEncryption).toBe("aws:kms");
  expect(input.SSEKMSKeyId).toContain("arn:aws:kms");
  expect(input.ContentType).toBe("text/plain");
  expect(input.ChecksumSHA256).toBe(Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","hex").toString("base64"));
});