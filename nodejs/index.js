import { launch } from "puppeteer-core";
import Chromium from "@sparticuz/chromium";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
console.log("Loading function");
export async function handler(event, context) {
	const browser = await launch({
		args: Chromium.args,
		defaultViewport: Chromium.defaultViewport,
		executablePath: await Chromium.executablePath(
			process.env.AWS_EXECUTION_ENV ? "/opt/nodejs/node_modules/@sparticuz/chromium/bin" : undefined
		),
		headless: Chromium.headless,
		ignoreHTTPSErrors: true,
	});
	const page = await browser.newPage();
	try {
		const urlToRead = event.webUrl;
		const domain = new URL(urlToRead).host;
		const outputFilePath = `${urlToRead.split(`${domain}/`)[1]}`;
		let now = new Date();
		now.setHours(48);
		const cookies = [
			{
				url: urlToRead,
				domain: domain,
				path: "/",
				expires: new Date().getTime(),
				"max-age": 60 * 60 * 24 * 2,
			},
		];
		await page.setCookie(...cookies);
		await page.goto(urlToRead, { timeout: 60000, waitUntil: ["load", "networkidle0", "domcontentloaded"] });
		const html = await page.content();
		const s3Client = new S3Client({
			region: process.env.AWS_BUCKET_REGION,
			credentials: {
				accessKeyId: process.env.ACCESS_KEY,
				secretAccessKey: process.env.SECRET_KEY,
			},
		});
		const bucketName = process.env.AWS_BUCKET_NAME;
		const command = new PutObjectCommand({
			Bucket: bucketName,
			Key: outputFilePath,
			Body: html,
		});
		try {
			const response = await s3Client.send(command);
			console.log(response);
		} catch (err) {
			console.error(err);
		}
	} catch (error) {
		console.log(error);
	} finally {
		await page.close();
		await browser.close();
	}
	return;
}
