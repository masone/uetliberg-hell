import { put, list } from "@vercel/blob";

const ENV = process.env.NODE_ENV || "development";

export async function getCache(
  pathname: string,
  fetchFn: () => Promise<Buffer | string>,
): Promise<Buffer> {
  const blobPath = `${ENV}/${pathname}`;
  const { blobs } = await list({ prefix: blobPath, limit: 1 });
  const blob = blobs.find((b) => b.pathname === blobPath);

  if (blob) {
    console.log(`Reading from cache: ${blob.url}`);
    const response = await fetch(blob.url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  console.log(`Fetching new data: ${blobPath}`);
  const data = await fetchFn();
  await put(blobPath, data, { access: "public", addRandomSuffix: false });
  return Buffer.from(data);
}
