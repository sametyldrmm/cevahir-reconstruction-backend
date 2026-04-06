import { CleanLogger } from '../../logger';

const logger = new CleanLogger('S3Trigger');

export const handler = async (event: any) => {
  try {
    const bucket = event.Records[0].s3.bucket.name;
    const key = event.Records[0].s3.object.key;

    logger.log(`Yeni dosya yüklendi: ${key}, Bucket: ${bucket}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Dosya başarıyla işlendi',
        bucket,
        key,
      }),
    };
  } catch (error: any) {
    logger.error('Hata:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Bir hata oluştu',
        error: error.message,
      }),
    };
  }
};

