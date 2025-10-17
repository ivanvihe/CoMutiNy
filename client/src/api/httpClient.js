import axios from 'axios';
import resolveServerUrl from '../utils/resolveServerUrl.js';

const httpClient = axios.create({
  baseURL: resolveServerUrl()
});

export default httpClient;
