# Media Master vision workflow setup

The workflow receives an image and prompt from Media Master, calls Amazon Bedrock, and returns generated text. Authentication is required before the workflow accepts a request.

## Requirements

- A production n8n instance
- AWS credentials permitted to call `bedrock:InvokeModel` for Amazon Nova Lite
- A random endpoint token containing at least 32 characters

Do not put AWS access keys or the endpoint token into the workflow JSON.

## Setup

1. Generate an endpoint token:

   ```sh
   openssl rand -hex 32
   ```

2. Set `LMT_MEDIA_MASTER_TOKEN` in the n8n process environment to that token, then restart n8n.
3. Import `lookit-media-master-bedrock-vision.json`.
4. Open **Bedrock Converse (Vision)** and select an n8n AWS credential. Use a least-privilege IAM identity and keep its keys in n8n's encrypted credential store.
5. Confirm the Bedrock region and model URL are correct for the AWS account.
6. Save and activate the workflow.
7. Copy the production webhook URL into **Media Master → Settings**.
8. Enter the same endpoint token in Media Master, save, then run **Test Connection**.

The validation node rejects missing, incorrect, or shorter-than-32-character tokens with HTTP 401. Media Master sends the token in the `Authorization: Bearer <token>` header.

## Request and response

Media Master sends:

```json
{
  "image": "data:image/jpeg;base64,...",
  "mime": "image/jpeg",
  "prompt": "Generation instructions",
  "site": {
    "url": "https://example.com",
    "name": "Example"
  }
}
```

A successful response is:

```json
{
  "text": "Generated text"
}
```

The image is passed to Bedrock for the requested generation only. The workflow does not persist images, prompts, or generated text.
