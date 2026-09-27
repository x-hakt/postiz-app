// x-hakt (PLN-25): tests only. isomorphic-dompurify's nested jsdom pulls in an ESM-only module
// that jest (CommonJS) can't load; the app itself is unaffected. Same DOMPurify, same config,
// on the repo's top-level (CommonJS) jsdom.
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const DOMPurify = createDOMPurify(new JSDOM('').window as any);
export default DOMPurify;
