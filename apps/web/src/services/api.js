const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

class ApiService {
  getAuthHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
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
    return { expires_in: data.expires_in };
  }

  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
    if (!response.ok && response.status !== 401) {
      throw new Error('Could not end the current session');
    }
  }

  // URL Scanning Service (Phishing Detection)
  async scanUrl(url) {
    const response = await fetch(`${API_BASE_URL}/phishing/v1/url/check`, {
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
    
    const response = await fetch(`${API_BASE_URL}/malware/v1/file/analyze`, {
      method: 'POST',
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
  async generateReport(scanId) {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ scanId })
    });
    return this.handleResponse(response);
  }

  async getReportsForScans(scanIds = []) {
    const params = new URLSearchParams();
    scanIds.forEach((scanId) => params.append('scan_id', String(scanId)));
    const response = await fetch(`${API_BASE_URL}/reports?${params.toString()}`, {
      headers: this.getAuthHeaders()
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
    if (!response.ok) {
      let message = 'Download failed';
      try {
        const body = await response.json();
        if (typeof body?.error === 'string' && body.error.trim()) message = body.error;
      } catch {
        // Keep a generic error when the gateway did not return JSON.
      }
      throw new Error(message);
    }
    return response.blob();
  }

  // Notifications Service
  async getNotifications() {
    const response = await fetch(`${API_BASE_URL}/notify`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // Health checks for individual services
  async checkServiceHealth() {
    const services = [
      { name: 'auth', url: `${API_BASE_URL}/auth/health` },
      { name: 'phishing', url: `${API_BASE_URL}/phishing/health` },
      { name: 'malware', url: `${API_BASE_URL}/malware/health` },
      { name: 'history', url: `${API_BASE_URL}/history/health` },
      { name: 'reports', url: `${API_BASE_URL}/reports/health` },
      { name: 'notifications', url: `${API_BASE_URL}/notify/health` }
    ];

    const results = await Promise.allSettled(
      services.map(async service => {
        try {
          const response = await fetch(service.url);
          const data = await response.json().catch(() => ({}));
          return { 
            name: service.name, 
            status: response.ok ? 'healthy' : 'unhealthy',
            message: data.message || data.status || 'OK'
          };
        } catch (error) {
          return { 
            name: service.name, 
            status: 'unavailable',
            message: error.message
          };
        }
      })
    );

    return results.map(result => result.value || result.reason);
  }
}

export default new ApiService();
