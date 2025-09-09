const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('access_token');
  }

  setAuthToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  }

  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // Auth Service
  async signup(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ email, password })
    });
    return this.handleResponse(response);
  }

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await this.handleResponse(response);
    if (data.access_token) {
      this.setAuthToken(data.access_token);
    }
    return data;
  }

  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async logout() {
    this.setAuthToken(null);
  }

  // URL Scanning Service (Phishing Detection)
  async scanUrl(url) {
    const response = await fetch(`${API_BASE_URL}/scan/url`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ url })
    });
    return this.handleResponse(response);
  }

  // File Scanning Service (Malware Detection)
  async scanFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/scan/file`, {
      method: 'POST',
      headers: {
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      body: formData
    });
    return this.handleResponse(response);
  }

  // History Service
  async getScanHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/history?${queryString}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getScanDetails(scanId) {
    const response = await fetch(`${API_BASE_URL}/history/${scanId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // Reports Service
  async generateReport(scanId, content) {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ scanId, content })
    });
    return this.handleResponse(response);
  }

  async getReport(reportId) {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async downloadReport(reportId) {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}/download`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }

  // Notifications Service
  async getNotifications() {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // Health checks
  async checkServiceHealth() {
    const services = [
      { name: 'auth', url: `${API_BASE_URL}/auth/health` },
      { name: 'phishing', url: `${API_BASE_URL}/scan/url/health` },
      { name: 'malware', url: `${API_BASE_URL}/scan/file/health` },
      { name: 'history', url: `${API_BASE_URL}/history/health` },
      { name: 'reports', url: `${API_BASE_URL}/reports/health` },
      { name: 'notifications', url: `${API_BASE_URL}/notifications/health` }
    ];

    const results = await Promise.allSettled(
      services.map(async service => {
        try {
          const response = await fetch(service.url);
          return { name: service.name, status: response.ok ? 'healthy' : 'unhealthy' };
        } catch {
          return { name: service.name, status: 'unavailable' };
        }
      })
    );

    return results.map(result => result.value);
  }
}

export default new ApiService();