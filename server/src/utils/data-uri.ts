import DatauriParser from 'datauri/parser.js';

interface MulterFile {
  originalname: string;
  buffer: Buffer;
}

const getDataUri = (file: MulterFile): DatauriParser => {
  const dUri = new DatauriParser();
  return dUri.format(file.originalname, file.buffer);
};

export default getDataUri;
