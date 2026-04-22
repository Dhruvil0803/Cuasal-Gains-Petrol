import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getSensors       = ()             => api.get('/sensors').then(r => r.data);
export const getSensorData    = (id, limit=50) => api.get(`/sensors/${id}?limit=${limit}`).then(r => r.data);
export const getSensorStats   = (id)           => api.get(`/sensors/${id}/stats`).then(r => r.data);
export const getCombined      = (limit=100)    => api.get(`/combined?limit=${limit}`).then(r => r.data);
export const getGraphData     = ()             => api.get('/graph').then(r => r.data);
export const getSharedData    = (a, b)         => api.get(`/shared-data?sensor_a=${a}&sensor_b=${b}`).then(r => r.data);
export const getImpact        = (id)           => api.get(`/impact/${id}`).then(r => r.data);
export const getAnomaly       = (id, evtType, evtSev) => {
  const params = evtType ? `?event_type=${evtType}&severity=${evtSev||'high'}` : '';
  return api.get(`/anomaly/${id}${params}`).then(r => r.data);
};
export const getEventImpact   = (type, sev)    => api.get(`/event-impact?event_type=${type}&severity=${sev}`).then(r => r.data);
export const getLiveHazards   = ()             => api.get('/live-hazards').then(r => r.data);
export const sendChat         = (message, thread_id) => api.post('/chat', { message, thread_id }).then(r => r.data);
