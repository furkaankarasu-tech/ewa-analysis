// Node-only harness: real XML parsing and image decoding for browser parser tests.
import {DOMParser as XmlParser} from '@xmldom/xmldom';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
globalThis.DOMParser=class {parseFromString(text,type){
 const errors=[];const doc=new XmlParser({errorHandler:{warning:()=>{},error:e=>errors.push(e),fatalError:e=>errors.push(e)}}).parseFromString(text,type);
 doc.querySelector=selector=>selector==='parsererror' && errors.length ? {} : null;
 return doc;
}};
globalThis.createImageBitmap=async blob=>{
 const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 return {width:info.width,height:info.height,data,close(){}};
};
globalThis.window={document:{createElement:tag=>{
 if(tag!=='canvas')throw Error('Unexpected element');let bitmap;
 return {getContext:()=>({drawImage:image=>bitmap=image,getImageData:()=>({data:bitmap.data})})};
}}};
