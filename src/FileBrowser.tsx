import { setChonkyDefaults } from 'chonky';
import { ChonkyIconFA } from 'chonky-icon-fontawesome';
import {
  ChonkyActions,
  ChonkyFileActionData,
  FileArray,
  FileData,
  FullFileBrowser,
} from 'chonky';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { downloadFile } from './helpers/util';


const BUCKET_NAME = import.meta.env.BUCKET_NAME || 'my-big-example-bucket';
const BACKEND_URL = import.meta.env.BACKEND_URL || 'http://localhost:3010';

setChonkyDefaults({ iconComponent: ChonkyIconFA });

const fetchAuthedBucketData = async (
  bucketName: string,
  prefix: string = '/'
) => {
  prefix = encodeURIComponent(prefix);
  let data = await fetch(
    `${BACKEND_URL}/api/${bucketName}/?prefix=${prefix}`
  )
    .then((response) => response.json())
    .then((data) => data)
    .catch((error) => console.error(error));
  return data;
};

const fetchS3BucketContents = (
  bucket: string,
  prefix: string
): Promise<FileArray> => {
  return fetchAuthedBucketData(bucket, prefix).then((response) => {
    const chonkyFiles: FileArray = [];
    const s3Objects = response.Contents;
    const s3Prefixes = response.CommonPrefixes;

    if (s3Objects) {
      chonkyFiles.push(
        ...s3Objects.map(
          (object: {
            Key: string;
            LastModified: any;
            Size: any;
          }): FileData => ({
            id: object.Key!,
            name: object.Key.split('/').pop()!,
            modDate: object.LastModified,
            size: object.Size,
          })
        )
      );
    }

    if (s3Prefixes) {
      chonkyFiles.push(
        ...s3Prefixes.map(
          (prefix: { Prefix: string }): FileData => ({
            id: prefix.Prefix!,
            name: prefix.Prefix!,
            isDir: true,
          })
        )
      );
    }

    return chonkyFiles;
  });
};

const fetchBucketItem = async (
  bucket: string,
  itemkey: string
): Promise<string> => {
  let data: string = await fetch(
    `http://localhost:3010/api/${bucket}/item?itemKey=${itemkey}`
  )
    .then((response) => response.json())
    .then((data) => data)
    .catch((error) => console.error(error));
  console.log(data);
  return data;
};

export const VFSBrowser: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [folderPrefix, setKeyPrefix] = useState<string>('/');
  const [files, setFiles] = useState<FileArray>([]);

  useEffect(() => {
    fetchS3BucketContents(BUCKET_NAME, folderPrefix)
      .then(setFiles)
      .catch((error) => setError(error.message));
  }, [folderPrefix, setFiles]);

  const folderChain = React.useMemo(() => {
    let folderChain: FileArray;
    if (folderPrefix === '/') {
      folderChain = [];
    } else {
      let currentPrefix = '';
      folderChain = folderPrefix
        .replace(/\/*$/, '')
        .split('/')
        .map((prefixPart): FileData => {
          currentPrefix = currentPrefix
            ? `${currentPrefix}/${prefixPart}`
            : prefixPart;
          return {
            id: currentPrefix,
            name: prefixPart,
            isDir: true,
          };
        });
    }
    folderChain.unshift({
      id: '/',
      name: BUCKET_NAME,
      isDir: true,
    });
    return folderChain;
  }, [folderPrefix]);

  const handleFileAction = useCallback(
    async (data: ChonkyFileActionData) => {
      if (data.id === ChonkyActions.DownloadFiles.id) {
        data.state.selectedFilesForAction.forEach(async (file) => {
          const url: string = await fetchBucketItem(BUCKET_NAME, file.id);
          downloadFile(url, file.id);
        });
        return;
      }
      if (data.id === ChonkyActions.OpenFiles.id) {
        if (data.payload.files && data.payload.files.length !== 1) {
          data.payload.files.forEach(async (file) => {
            const url: string = await fetchBucketItem(BUCKET_NAME, file.id);
            downloadFile(url, file.id);
          });
          return;
        }
        if (data.payload.targetFile && !data.payload.targetFile.isDir) {
          const url: string = await fetchBucketItem(
            BUCKET_NAME,
            data.payload.files[0].id
          );
          window.open(url, '_blank');
          return;
        }
        if (!data.payload.targetFile || !data.payload.targetFile.isDir) return;

        const newPrefix = `${data.payload.targetFile.id.replace(/\/*$/, '')}/`;
        console.log(`Key prefix: ${newPrefix}`);
        setKeyPrefix(newPrefix);
      }
    },
    [setKeyPrefix]
  );

  const myFileActions = [ChonkyActions.DownloadFiles, ChonkyActions.OpenFiles];

  const thumbnailGenerator = (file: { [x: string]: string; name: string }) => {
    if (
      !file.name.endsWith('.png') &&
      !file.name.endsWith('.jpg') &&
      !file.name.endsWith('.JPG') &&
      !file.name.endsWith('.gif')
    ) {
      return;
    }

    let url = fetchBucketItem(BUCKET_NAME, file.id);
    return url; 
  };

  return (
    <>
      <div style={{ height: '100vh' }}>
        <FullFileBrowser
          files={files}
          folderChain={folderChain}
          fileActions={myFileActions}
          onFileAction={handleFileAction}
          thumbnailGenerator={thumbnailGenerator}
        />
      </div>
    </>
  );
};
