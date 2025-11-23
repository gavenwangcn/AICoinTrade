// 前端日志工具类 - 仅输出到浏览器console
class FrontendLogger {
    constructor() {
        // 从localStorage读取日志开关状态，默认为开启
        this.enabled = localStorage.getItem('frontendLoggingEnabled') !== 'false';
        this.updateButtonState();
    }

    /**
     * 开启日志
     */
    enable() {
        this.enabled = true;
        localStorage.setItem('frontendLoggingEnabled', 'true');
        this.updateButtonState();
        console.log('[日志系统] 日志输出已开启');
    }

    /**
     * 关闭日志
     */
    disable() {
        this.enabled = false;
        localStorage.setItem('frontendLoggingEnabled', 'false');
        this.updateButtonState();
        console.log('[日志系统] 日志输出已关闭');
    }

    /**
     * 切换日志状态
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    /**
     * 检查日志是否启用
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * 更新按钮状态
     */
    updateButtonState() {
        const btn = document.getElementById('logToggleBtn');
        const icon = document.getElementById('logToggleIcon');
        if (btn && icon) {
            if (this.enabled) {
                btn.classList.add('active');
                btn.title = '点击关闭日志输出';
                icon.className = 'bi bi-terminal-fill';
            } else {
                btn.classList.remove('active');
                btn.title = '点击开启日志输出';
                icon.className = 'bi bi-terminal';
            }
        }
    }

    /**
     * 格式化时间戳
     */
    formatTimestamp() {
        const now = new Date();
        return now.toLocaleString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
    }

    /**
     * 记录API调用
     * @param {string} method - HTTP方法
     * @param {string} url - API URL
     * @param {object} options - 请求选项（可选）
     */
    logApiCall(method, url, options = {}) {
        if (!this.enabled) return;
        const timestamp = this.formatTimestamp();
        console.log(`[${timestamp}] [API调用] ${method} ${url}`, options.body ? { body: options.body } : '');
    }

    /**
     * 记录API成功响应
     * @param {string} method - HTTP方法
     * @param {string} url - API URL
     * @param {Response} response - 响应对象
     * @param {object} data - 响应数据（可选）
     */
    logApiSuccess(method, url, response, data = null) {
        if (!this.enabled) return;
        const timestamp = this.formatTimestamp();
        const logData = {
            status: response.status,
            statusText: response.statusText
        };
        if (data) {
            logData.dataSize = JSON.stringify(data).length;
        }
        console.log(`[${timestamp}] [API成功] ${method} ${url}`, logData);
    }

    /**
     * 记录API错误
     * @param {string} method - HTTP方法
     * @param {string} url - API URL
     * @param {Error|object} error - 错误对象
     * @param {Response} response - 响应对象（如果有）
     * @param {object} errorData - 错误响应数据（如果有）
     */
    logApiError(method, url, error, response = null, errorData = null) {
        if (!this.enabled) return;
        const timestamp = this.formatTimestamp();
        const errorInfo = {
            method: method,
            url: url,
            errorType: error.constructor?.name || 'Error',
            errorMessage: error.message || String(error)
        };

        if (response) {
            errorInfo.status = response.status;
            errorInfo.statusText = response.statusText;
        }

        if (errorData) {
            errorInfo.errorData = errorData;
        }

        if (error.stack) {
            errorInfo.stack = error.stack;
        }

        console.error(`[${timestamp}] [API错误] ${method} ${url}`, errorInfo);
    }

    /**
     * 记录数据加载错误
     * @param {string} dataType - 数据类型
     * @param {Error} error - 错误对象
     * @param {string} url - API URL（可选）
     */
    logDataLoadError(dataType, error, url = null) {
        if (!this.enabled) return;
        const timestamp = this.formatTimestamp();
        const errorInfo = {
            dataType: dataType,
            errorMessage: error.message || String(error),
            errorType: error.constructor?.name || 'Error'
        };
        if (url) {
            errorInfo.url = url;
        }
        if (error.stack) {
            errorInfo.stack = error.stack;
        }
        console.error(`[${timestamp}] [数据加载错误] ${dataType}`, errorInfo);
    }

    /**
     * 记录一般信息
     * @param {string} category - 日志分类
     * @param {string} message - 消息
     * @param {object} details - 详细信息（可选）
     */
    logInfo(category, message, details = null) {
        if (!this.enabled) return;
        const timestamp = this.formatTimestamp();
        if (details) {
            console.log(`[${timestamp}] [${category}] ${message}`, details);
        } else {
            console.log(`[${timestamp}] [${category}] ${message}`);
        }
    }

    /**
     * 记录警告信息
     * @param {string} category - 日志分类
     * @param {string} message - 消息
     * @param {object} details - 详细信息（可选）
     */
    logWarn(category, message, details = null) {
        if (!this.enabled) return;
        const timestamp = this.formatTimestamp();
        if (details) {
            console.warn(`[${timestamp}] [${category}] ${message}`, details);
        } else {
            console.warn(`[${timestamp}] [${category}] ${message}`);
        }
    }
}

// 创建全局日志实例
const frontendLogger = new FrontendLogger();

class TradingApp {
    constructor() {
        this.currentModelId = null;
        this.isAggregatedView = false;
        this.currentModelAutoTradingEnabled = true;
        this.chart = null;
        this.refreshIntervals = {
            market: null,
            portfolio: null,
            trades: null
        };
        this.isChinese = this.detectLanguage();
        this.showSystemPrompt = false;
        this.settingsCache = null;
        this.latestConversations = [];
        this.logger = frontendLogger; // 使用全局日志实例
        this.init();
    }

    updateExecuteButtonState() {
        const executeBtn = document.getElementById('executeBtn');
        if (!executeBtn) return;

        if (this.isAggregatedView || !this.currentModelId) {
            executeBtn.disabled = true;
            executeBtn.title = '请选择某个模型后执行';
        } else {
            executeBtn.disabled = false;
            executeBtn.title = '执行当前模型的交易周期';
        }

        this.updateAutoTradingButtonState();
    }

    updateAutoTradingButtonState() {
        const pauseBtn = document.getElementById('pauseAutoBtn');
        if (!pauseBtn) return;

        if (this.isAggregatedView || !this.currentModelId) {
            pauseBtn.disabled = true;
            pauseBtn.title = '请选择对应的交易模型';
            pauseBtn.innerHTML = '<i class="bi bi-pause-circle"></i> 关闭交易';
            return;
        }

        if (this.currentModelAutoTradingEnabled) {
            pauseBtn.disabled = false;
            pauseBtn.title = '暂停该模型的自动化交易';
            pauseBtn.innerHTML = '<i class="bi bi-pause-circle"></i> 关闭交易';
        } else {
            pauseBtn.disabled = true;
            pauseBtn.title = '该模型自动交易已关闭，点击执行交易可重新开启';
            pauseBtn.innerHTML = '<i class="bi bi-stop-circle"></i> 已关闭';
        }
    }

    async executeCurrentModel() {
        if (!this.currentModelId || this.isAggregatedView) return;

        const executeBtn = document.getElementById('executeBtn');
        const originalContent = executeBtn.innerHTML;
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> 执行中...';

        const url = `/api/models/${this.currentModelId}/execute`;
        this.logger.logApiCall('POST', url);

        try {
            const response = await fetch(url, {
                method: 'POST'
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                this.logger.logApiError('POST', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('POST', url, new Error(data.error || `HTTP ${response.status}`), response, data);
                alert(data.error || '执行失败');
            } else if (data.error) {
                this.logger.logWarn('交易执行', `执行返回错误: ${data.error}`, { modelId: this.currentModelId, error: data.error });
                alert(data.error || '执行失败');
            } else {
                this.logger.logApiSuccess('POST', url, response, data);
                this.logger.logInfo('交易执行', '交易周期执行成功', { modelId: this.currentModelId });
                alert('执行成功，已触发交易周期');
                await this.loadModelData();
            }
        } catch (error) {
            this.logger.logApiError('POST', url, error);
            alert('执行交易失败，请稍后再试');
        } finally {
            executeBtn.innerHTML = originalContent;
            executeBtn.disabled = this.isAggregatedView || !this.currentModelId;
        }
    }

    async pauseAutoTrading() {
        if (this.isAggregatedView || !this.currentModelId) {
            alert('请选择对应的交易模型');
            return;
        }

        if (!this.currentModelAutoTradingEnabled) {
            alert('该模型自动交易已关闭，执行交易可重新开启');
            return;
        }

        const pauseBtn = document.getElementById('pauseAutoBtn');
        const originalContent = pauseBtn ? pauseBtn.innerHTML : null;
        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> 关闭中...';
        }

        const url = `/api/models/${this.currentModelId}/auto-trading`;
        this.logger.logApiCall('POST', url, { body: { enabled: false } });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                this.logger.logApiError('POST', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('POST', url, new Error(data.error || `HTTP ${response.status}`), response, data);
                throw new Error(data.error || '关闭失败');
            }

            if (data.error) {
                this.logger.logWarn('自动交易控制', `关闭自动交易返回错误: ${data.error}`, { modelId: this.currentModelId, error: data.error });
                throw new Error(data.error || '关闭失败');
            }

            this.logger.logApiSuccess('POST', url, response, data);
            this.logger.logInfo('自动交易控制', '自动交易已关闭', { modelId: this.currentModelId });
            this.currentModelAutoTradingEnabled = false;
            alert('该模型的自动化交易已关闭');
            await this.loadModelData();
        } catch (error) {
            this.logger.logApiError('POST', url, error);
            alert(error.message || '关闭自动化交易失败');
        } finally {
            if (pauseBtn) {
                pauseBtn.innerHTML = originalContent || '<i class="bi bi-pause-circle"></i> 关闭交易';
            }
            this.updateAutoTradingButtonState();
        }
    }

    detectLanguage() {
        // Check if the page language is Chinese or if user's language includes Chinese
        const lang = document.documentElement.lang || navigator.language || navigator.userLanguage;
        return lang.toLowerCase().includes('zh');
    }

    escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }

        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    cleanCodeFences(text) {
        if (!text) return '';
        return text.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    formatAiResponseText(response) {
        if (response === null || response === undefined) {
            return '';
        }

        let raw = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
        raw = this.cleanCodeFences(raw);

        try {
            let parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return JSON.stringify(parsed, null, 2);
            }

            if (parsed && typeof parsed === 'object') {
                const normalized = Object.keys(parsed).map(symbol => ({
                    symbol,
                    ...(parsed[symbol] && typeof parsed[symbol] === 'object'
                        ? parsed[symbol]
                        : { value: parsed[symbol] })
                }));
                return JSON.stringify(normalized, null, 2);
            }

            return JSON.stringify([parsed], null, 2);
        } catch (error) {
            return raw;
        }
    }

    formatPnl(value, isPnl = false) {
        // Format profit/loss value based on language preference
        if (!isPnl || value === 0) {
            return `$${Math.abs(value).toFixed(2)}`;
        }

        const absValue = Math.abs(value);
        const formatted = `$${absValue.toFixed(2)}`;

        if (this.isChinese) {
            // Chinese convention: red for profit (positive), show + sign
            if (value > 0) {
                return `+${formatted}`;
            } else {
                return `-${formatted}`;
            }
        } else {
            // Default: show sign for positive values
            if (value > 0) {
                return `+${formatted}`;
            }
            return formatted;
        }
    }

    getPnlClass(value, isPnl = false) {
        // Return CSS class based on profit/loss and language preference
        if (!isPnl || value === 0) {
            return '';
        }

        if (value > 0) {
            // In Chinese: positive (profit) should be red
            return this.isChinese ? 'positive' : 'positive';
        } else if (value < 0) {
            // In Chinese: negative (loss) should not be red
            return this.isChinese ? 'negative' : 'negative';
        }
        return '';
    }

    init() {
        // 初始化日志按钮状态
        this.logger.updateButtonState();
        this.initEventListeners();
        this.loadModels();
        this.loadMarketPrices();
        this.startRefreshCycles();
        this.loadSettingsCache();
    }

    async loadSettingsCache() {
        const url = '/api/settings';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let settings;
            try {
                settings = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                return;
            }

            this.logger.logApiSuccess('GET', url, response);
            
            this.settingsCache = settings;
            this.showSystemPrompt = Boolean(settings.show_system_prompt);

            const toggle = document.getElementById('showSystemPrompt');
            if (toggle) {
                toggle.checked = this.showSystemPrompt;
            }

            if (this.latestConversations?.length) {
                this.updateConversations(this.latestConversations);
            }
        } catch (error) {
            this.logger.logDataLoadError('设置缓存', error, url);
        }
    }

    initEventListeners() {
        // Update Modal
        document.getElementById('closeUpdateModalBtn').addEventListener('click', () => this.hideUpdateModal());
        document.getElementById('dismissUpdateBtn').addEventListener('click', () => this.dismissUpdate());

        // Log Toggle Button
        const logToggleBtn = document.getElementById('logToggleBtn');
        if (logToggleBtn) {
            logToggleBtn.addEventListener('click', () => {
                this.logger.toggle();
            });
        }

        // API Provider Modal
        document.getElementById('addApiProviderBtn').addEventListener('click', () => this.showApiProviderModal());
        document.getElementById('closeApiProviderModalBtn').addEventListener('click', () => this.hideApiProviderModal());
        document.getElementById('cancelApiProviderBtn').addEventListener('click', () => this.hideApiProviderModal());
        document.getElementById('saveApiProviderBtn').addEventListener('click', () => this.saveApiProvider());
        document.getElementById('fetchModelsBtn').addEventListener('click', () => this.fetchModels());

        // Model Modal
        document.getElementById('addModelBtn').addEventListener('click', () => this.showModal());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('submitBtn').addEventListener('click', () => this.submitModel());
        document.getElementById('modelProvider').addEventListener('change', (e) => this.updateModelOptions(e.target.value));

        // Refresh
        document.getElementById('refreshBtn').addEventListener('click', () => this.refresh());

        // Manual execute
        document.getElementById('executeBtn').addEventListener('click', () => this.executeCurrentModel());
        document.getElementById('pauseAutoBtn').addEventListener('click', () => this.pauseAutoTrading());

        // Settings Modal
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('closeSettingsModalBtn').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('cancelSettingsBtn').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

        // Coin Config Modal
        document.getElementById('coinConfigBtn').addEventListener('click', () => this.showCoinModal());
        document.getElementById('closeCoinModalBtn').addEventListener('click', () => this.hideCoinModal());
        document.getElementById('cancelCoinBtn').addEventListener('click', () => this.hideCoinModal());
        document.getElementById('saveCoinBtn').addEventListener('click', () => this.saveCoin());

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    async loadModels() {
        const url = '/api/models';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let models;
            try {
                models = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                return;
            }

            this.logger.logApiSuccess('GET', url, response, models);
            this.logger.logInfo('数据加载', `成功加载${models.length}个模型`, { count: models.length });
            
            this.renderModels(models);

            // Initialize with aggregated view if no model is selected
            if (models.length > 0 && !this.currentModelId && !this.isAggregatedView) {
                this.showAggregatedView();
            }
        } catch (error) {
            this.logger.logDataLoadError('模型列表', error, url);
        }
    }

    renderModels(models) {
        const container = document.getElementById('modelList');

        if (models.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无模型</div>';
            this.updateExecuteButtonState();
            return;
        }

        // Add aggregated view option at the top
        let html = `
            <div class="model-item ${this.isAggregatedView ? 'active' : ''}"
                 onclick="app.showAggregatedView()">
                <div class="model-name">
                    <i class="bi bi-bar-chart-fill"></i> 聚合视图
                </div>
                <div class="model-info">
                    <span>所有模型汇总</span>
                </div>
            </div>
        `;

        // Add individual models
        html += models.map(model => `
            <div class="model-item ${model.id === this.currentModelId && !this.isAggregatedView ? 'active' : ''}"
                 onclick="app.selectModel(${model.id})">
                <div class="model-name">${model.name}</div>
                <div class="model-info">
                    <span>${model.model_name}</span>
                    <span class="model-delete" onclick="event.stopPropagation(); app.deleteModel(${model.id})">
                        <i class="bi bi-trash"></i>
                    </span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
        this.updateExecuteButtonState();
    }

    async showAggregatedView() {
        this.isAggregatedView = true;
        this.currentModelId = null;
        this.loadModels();
        await this.loadAggregatedData();
        this.hideTabsInAggregatedView();
        this.updateExecuteButtonState();
        this.currentModelAutoTradingEnabled = false;
        this.updateAutoTradingButtonState();
    }

    async selectModel(modelId) {
        this.currentModelId = modelId;
        this.isAggregatedView = false;
        this.loadModels();
        await this.loadModelData();
        this.showTabsInSingleModelView();
        this.updateExecuteButtonState();
    }

    async loadModelData() {
        if (!this.currentModelId) return;

        const portfolioUrl = `/api/models/${this.currentModelId}/portfolio`;
        const tradesUrl = `/api/models/${this.currentModelId}/trades?limit=50`;
        const conversationsUrl = `/api/models/${this.currentModelId}/conversations?limit=20`;

        this.logger.logApiCall('GET', portfolioUrl);
        this.logger.logApiCall('GET', tradesUrl);
        this.logger.logApiCall('GET', conversationsUrl);

        try {
            const [portfolioResponse, tradesResponse, conversationsResponse] = await Promise.all([
                fetch(portfolioUrl),
                fetch(tradesUrl),
                fetch(conversationsUrl)
            ]);

            // Parse responses with error handling
            let portfolioPayload, trades, conversations;

            try {
                if (portfolioResponse.ok) {
                    portfolioPayload = await portfolioResponse.json();
                    this.logger.logApiSuccess('GET', portfolioUrl, portfolioResponse);
                } else {
                    const errorData = await portfolioResponse.json().catch(() => ({ error: `HTTP ${portfolioResponse.status}` }));
                    this.logger.logApiError('GET', portfolioUrl, new Error(errorData.error || '加载持仓失败'), portfolioResponse, errorData);
                    portfolioPayload = { error: errorData.error || 'Failed to load portfolio' };
                }
            } catch (error) {
                this.logger.logApiError('GET', portfolioUrl, error, portfolioResponse);
                portfolioPayload = { error: error.message };
            }

            try {
                if (tradesResponse.ok) {
                    trades = await tradesResponse.json();
                    this.logger.logApiSuccess('GET', tradesUrl, tradesResponse);
                } else {
                    this.logger.logApiError('GET', tradesUrl, new Error(`HTTP ${tradesResponse.status}`), tradesResponse);
                    trades = [];
                }
            } catch (error) {
                this.logger.logApiError('GET', tradesUrl, error, tradesResponse);
                trades = [];
            }

            try {
                if (conversationsResponse.ok) {
                    conversations = await conversationsResponse.json();
                    this.logger.logApiSuccess('GET', conversationsUrl, conversationsResponse);
                } else {
                    this.logger.logApiError('GET', conversationsUrl, new Error(`HTTP ${conversationsResponse.status}`), conversationsResponse);
                    conversations = [];
                }
            } catch (error) {
                this.logger.logApiError('GET', conversationsUrl, error, conversationsResponse);
                conversations = [];
            }

            // Check for errors in portfolio
            if (portfolioPayload.error) {
                this.logger.logDataLoadError('持仓数据', new Error(portfolioPayload.error), portfolioUrl);
                return;
            }

            const { portfolio, account_value_history, auto_trading_enabled } = portfolioPayload;

            this.currentModelAutoTradingEnabled = Boolean(auto_trading_enabled);
            this.updateAutoTradingButtonState();

            // Check if portfolio data exists
            if (!portfolio) {
                this.logger.logDataLoadError('持仓数据', new Error('持仓数据为空'), portfolioUrl);
                return;
            }

            this.logger.logInfo('数据加载', '成功加载模型数据', {
                modelId: this.currentModelId,
                positionsCount: (portfolio.positions || []).length,
                tradesCount: (trades || []).length,
                conversationsCount: (conversations || []).length
            });

            this.updateStats(portfolio, false);
            this.updateSingleModelChart(account_value_history, portfolio.total_value);
            this.updatePositions(portfolio.positions || [], false);
            this.updateTrades(trades || []);
            this.updateConversations(conversations || []);
        } catch (error) {
            this.logger.logDataLoadError('模型数据', error);
            this.updateAutoTradingButtonState();
        }
    }

    async loadAggregatedData() {
        const url = '/api/aggregated/portfolio';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                return;
            }

            this.logger.logApiSuccess('GET', url, response, data);
            this.logger.logInfo('数据加载', '成功加载聚合数据', {
                modelCount: data.model_count || 0,
                chartDataPoints: (data.chart_data || []).length
            });

            this.updateStats(data.portfolio, true);
            this.updateMultiModelChart(data.chart_data);
            // Skip positions, trades, and conversations in aggregated view
            this.hideTabsInAggregatedView();
            this.updateAutoTradingButtonState();
        } catch (error) {
            this.logger.logDataLoadError('聚合数据', error, url);
            this.updateAutoTradingButtonState();
        }
    }

    hideTabsInAggregatedView() {
        // Hide the entire tabbed content section in aggregated view
        const contentCard = document.querySelector('.content-card .card-tabs').parentElement;
        if (contentCard) {
            contentCard.style.display = 'none';
        }
    }

    showTabsInSingleModelView() {
        // Show the tabbed content section in single model view
        const contentCard = document.querySelector('.content-card .card-tabs').parentElement;
        if (contentCard) {
            contentCard.style.display = 'block';
        }
    }

    updateStats(portfolio, isAggregated = false) {
        const stats = [
            { value: portfolio.total_value || 0, isPnl: false },
            { value: portfolio.cash || 0, isPnl: false },
            { value: portfolio.realized_pnl || 0, isPnl: true },
            { value: portfolio.unrealized_pnl || 0, isPnl: true }
        ];

        document.querySelectorAll('.stat-value').forEach((el, index) => {
            if (stats[index]) {
                el.textContent = this.formatPnl(stats[index].value, stats[index].isPnl);
                el.className = `stat-value ${this.getPnlClass(stats[index].value, stats[index].isPnl)}`;
            }
        });

        // Update title for aggregated view
        const titleElement = document.querySelector('.account-info h2');
        if (titleElement) {
            if (isAggregated) {
                titleElement.innerHTML = '<i class="bi bi-bar-chart-fill"></i> 聚合账户总览';
            } else {
                titleElement.innerHTML = '<i class="bi bi-wallet2"></i> 账户信息';
            }
        }
    }

    updateSingleModelChart(history, currentValue) {
        const chartDom = document.getElementById('accountChart');

        // Dispose existing chart to avoid state pollution
        if (this.chart) {
            this.chart.dispose();
        }

        this.chart = echarts.init(chartDom);
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });

        const data = history.reverse().map(h => ({
            time: new Date(h.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour: '2-digit',
                minute: '2-digit'
            }),
            value: h.total_value
        }));

        if (currentValue !== undefined && currentValue !== null) {
            const now = new Date();
            const currentTime = now.toLocaleTimeString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour: '2-digit',
                minute: '2-digit'
            });
            data.push({
                time: currentTime,
                value: currentValue
            });
        }

        const option = {
            grid: {
                left: '60',
                right: '20',
                bottom: '40',
                top: '20',
                containLabel: false
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: data.map(d => d.time),
                axisLine: { lineStyle: { color: '#e5e6eb' } },
                axisLabel: { color: '#86909c', fontSize: 11 }
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLine: { lineStyle: { color: '#e5e6eb' } },
                axisLabel: {
                    color: '#86909c',
                    fontSize: 11,
                    formatter: (value) => `$${value.toLocaleString()}`
                },
                splitLine: { lineStyle: { color: '#f2f3f5' } }
            },
            series: [{
                type: 'line',
                data: data.map(d => d.value),
                smooth: true,
                symbol: 'none',
                lineStyle: { color: '#3370ff', width: 2 },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(51, 112, 255, 0.2)' },
                            { offset: 1, color: 'rgba(51, 112, 255, 0)' }
                        ]
                    }
                }
            }],
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e5e6eb',
                borderWidth: 1,
                textStyle: { color: '#1d2129' },
                formatter: (params) => {
                    const value = params[0].value;
                    return `${params[0].axisValue}<br/>账户价值: $${value.toFixed(2)}`;
                }
            }
        };

        this.chart.setOption(option);

        setTimeout(() => {
            if (this.chart) {
                this.chart.resize();
            }
        }, 100);
    }

    updateMultiModelChart(chartData) {
        const chartDom = document.getElementById('accountChart');

        // Dispose existing chart to avoid state pollution
        if (this.chart) {
            this.chart.dispose();
        }

        this.chart = echarts.init(chartDom);
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });

        if (!chartData || chartData.length === 0) {
            // Show empty state for multi-model chart
            this.chart.setOption({
                title: {
                    text: '暂无模型数据',
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#86909c', fontSize: 14 }
                },
                xAxis: { show: false },
                yAxis: { show: false },
                series: []
            });
            return;
        }

        // Colors for different models
        const colors = [
            '#3370ff', '#ff6b35', '#00b96b', '#722ed1', '#fa8c16',
            '#eb2f96', '#13c2c2', '#faad14', '#f5222d', '#52c41a'
        ];

        // Prepare time axis - get all timestamps and sort them chronologically
        const allTimestamps = new Set();
        chartData.forEach(model => {
            model.data.forEach(point => {
                allTimestamps.add(point.timestamp);
            });
        });

        // Convert to array and sort by timestamp (not string sort)
        const timeAxis = Array.from(allTimestamps).sort((a, b) => {
            const timeA = new Date(a.replace(' ', 'T') + 'Z').getTime();
            const timeB = new Date(b.replace(' ', 'T') + 'Z').getTime();
            return timeA - timeB;
        });

        // Format time labels for display
        const formattedTimeAxis = timeAxis.map(timestamp => {
            return new Date(timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour: '2-digit',
                minute: '2-digit'
            });
        });

        // Prepare series data for each model
        const series = chartData.map((model, index) => {
            const color = colors[index % colors.length];

            // Create data points aligned with time axis
            const dataPoints = timeAxis.map(time => {
                const point = model.data.find(p => p.timestamp === time);
                return point ? point.value : null;
            });

            return {
                name: model.model_name,
                type: 'line',
                data: dataPoints,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: { color: color, width: 2 },
                itemStyle: { color: color },
                connectNulls: true  // Connect points even with null values
            };
        });

        const option = {
            title: {
                text: '模型表现对比',
                left: 'center',
                top: 10,
                textStyle: { color: '#1d2129', fontSize: 16, fontWeight: 'normal' }
            },
            grid: {
                left: '60',
                right: '20',
                bottom: '80',
                top: '50',
                containLabel: false
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: formattedTimeAxis,
                axisLine: { lineStyle: { color: '#e5e6eb' } },
                axisLabel: { color: '#86909c', fontSize: 11, rotate: 45 }
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLine: { lineStyle: { color: '#e5e6eb' } },
                axisLabel: {
                    color: '#86909c',
                    fontSize: 11,
                    formatter: (value) => `$${value.toLocaleString()}`
                },
                splitLine: { lineStyle: { color: '#f2f3f5' } }
            },
            legend: {
                data: chartData.map(model => model.model_name),
                bottom: 10,
                itemGap: 20,
                textStyle: { color: '#1d2129', fontSize: 12 }
            },
            series: series,
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e5e6eb',
                borderWidth: 1,
                textStyle: { color: '#1d2129' },
                formatter: (params) => {
                    let result = `${params[0].axisValue}<br/>`;
                    params.forEach(param => {
                        if (param.value !== null) {
                            result += `${param.marker}${param.seriesName}: $${param.value.toFixed(2)}<br/>`;
                        }
                    });
                    return result;
                }
            }
        };

        this.chart.setOption(option);

        setTimeout(() => {
            if (this.chart) {
                this.chart.resize();
            }
        }, 100);
    }

    updatePositions(positions, isAggregated = false) {
        const tbody = document.getElementById('positionsBody');

        if (!Array.isArray(positions) || positions.length === 0) {
            if (isAggregated) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state">聚合视图暂无持仓</td></tr>';
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无持仓</td></tr>';
            }
            return;
        }

        tbody.innerHTML = positions.map(pos => {
            const sideClass = pos.side === 'long' ? 'badge-long' : 'badge-short';
            const sideText = pos.side === 'long' ? '做多' : '做空';

            const currentPrice = pos.current_price !== null && pos.current_price !== undefined
                ? `$${pos.current_price.toFixed(2)}`
                : '-';

            let pnlDisplay = '-';
            let pnlClass = '';
            if (pos.pnl !== undefined && pos.pnl !== 0) {
                pnlDisplay = this.formatPnl(pos.pnl, true);
                pnlClass = this.getPnlClass(pos.pnl, true);
            }

            return `
                <tr>
                    <td><strong>${pos.coin}</strong></td>
                    <td><span class="badge ${sideClass}">${sideText}</span></td>
                    <td>${pos.quantity.toFixed(4)}</td>
                    <td>$${pos.avg_price.toFixed(2)}</td>
                    <td>${currentPrice}</td>
                    <td>${pos.leverage}x</td>
                    <td class="${pnlClass}"><strong>${pnlDisplay}</strong></td>
                </tr>
            `;
        }).join('');

        // Update positions title for aggregated view
        const positionsTitle = document.querySelector('#positionsTab .card-header h3');
        if (positionsTitle) {
            if (isAggregated) {
                positionsTitle.innerHTML = '<i class="bi bi-collection"></i> 聚合持仓';
            } else {
                positionsTitle.innerHTML = '<i class="bi bi-briefcase"></i> 当前持仓';
            }
        }
    }

    updateTrades(trades) {
        const tbody = document.getElementById('tradesBody');

        if (!Array.isArray(trades) || trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无交易记录</td></tr>';
            return;
        }

        tbody.innerHTML = trades.map(trade => {
            const signalMap = {
                'buy_to_enter': { badge: 'badge-buy', text: '开多' },
                'sell_to_enter': { badge: 'badge-sell', text: '开空' },
                'close_position': { badge: 'badge-close', text: '平仓' }
            };
            const signal = signalMap[trade.signal] || { badge: '', text: trade.signal };
            const pnlDisplay = this.formatPnl(trade.pnl, true);
            const pnlClass = this.getPnlClass(trade.pnl, true);

            return `
                <tr>
                    <td>${new Date(trade.timestamp.replace(' ', 'T') + 'Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                    <td><strong>${trade.coin}</strong></td>
                    <td><span class="badge ${signal.badge}">${signal.text}</span></td>
                    <td>${trade.quantity.toFixed(4)}</td>
                    <td>$${trade.price.toFixed(2)}</td>
                    <td class="${pnlClass}">${pnlDisplay}</td>
                    <td>$${trade.fee.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    updateConversations(conversations) {
        this.latestConversations = Array.isArray(conversations) ? conversations : [];
        const container = document.getElementById('conversationsBody');

        if (!this.latestConversations.length) {
            container.innerHTML = '<div class="empty-state">暂无对话记录</div>';
            return;
        }

        const showSystem = this.showSystemPrompt;

        container.innerHTML = this.latestConversations.map(conv => {
            const timestamp = new Date(conv.timestamp.replace(' ', 'T') + 'Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            const prompt = this.escapeHtml(conv.user_prompt || '');
            const responseText = this.formatAiResponseText(conv.ai_response || '');
            const response = this.escapeHtml(responseText || '');

            const systemBlock = showSystem ? `
                <div class="conversation-bubble conversation-system">
                    <div class="bubble-label"><i class="bi bi-terminal"></i> 系统提交</div>
                    <pre class="conversation-text">${prompt || '（无内容）'}</pre>
                </div>` : '';

            return `
                <div class="conversation-item">
                    <div class="conversation-time">${timestamp}</div>
                    ${systemBlock}
                    <div class="conversation-bubble conversation-ai">
                        <div class="bubble-label"><i class="bi bi-cpu"></i> AI回答</div>
                        <pre class="conversation-text">${response || '（无内容）'}</pre>
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadMarketPrices() {
        const url = '/api/market/prices';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let prices;
            try {
                prices = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                return;
            }

            this.logger.logApiSuccess('GET', url, response, prices);
            this.logger.logInfo('数据加载', `成功加载市场价格，共${Object.keys(prices).length}个币种`, {
                coinCount: Object.keys(prices).length
            });
            
            this.renderMarketPrices(prices);
        } catch (error) {
            this.logger.logDataLoadError('市场价格', error, url);
        }
    }

    renderMarketPrices(prices) {
        const container = document.getElementById('marketPrices');

        container.innerHTML = Object.entries(prices).map(([coin, data]) => {
            const changeClass = data.change_24h >= 0 ? 'positive' : 'negative';
            const changeIcon = data.change_24h >= 0 ? '▲' : '▼';

            return `
                <div class="price-item">
                    <div>
                        <div class="price-symbol">${coin}</div>
                        <div class="price-name">${data.name || ''}</div>
                        <div class="price-change ${changeClass}">${changeIcon} ${Math.abs(data.change_24h).toFixed(2)}%</div>
                    </div>
                    <div class="price-value">$${data.price.toFixed(2)}</div>
                </div>
            `;
        }).join('');
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    // API Provider Methods
    async showApiProviderModal() {
        this.loadProviders();
        document.getElementById('apiProviderModal').classList.add('show');
    }

    hideApiProviderModal() {
        document.getElementById('apiProviderModal').classList.remove('show');
        this.clearApiProviderForm();
    }

    clearApiProviderForm() {
        document.getElementById('providerName').value = '';
        document.getElementById('providerApiUrl').value = '';
        document.getElementById('providerApiKey').value = '';
        document.getElementById('availableModels').value = '';
    }

    async saveApiProvider() {
        const data = {
            name: document.getElementById('providerName').value.trim(),
            api_url: document.getElementById('providerApiUrl').value.trim(),
            api_key: document.getElementById('providerApiKey').value,
            models: document.getElementById('availableModels').value.trim()
        };

        if (!data.name || !data.api_url || !data.api_key) {
            alert('请填写所有必填字段');
            return;
        }

        const url = '/api/providers';
        this.logger.logApiCall('POST', url, { body: data });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                this.logger.logApiError('POST', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('POST', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '保存API提供方失败');
                return;
            }

            this.logger.logApiSuccess('POST', url, response, result);
            this.logger.logInfo('API提供方', 'API提供方保存成功', { providerName: data.name });
            
            this.hideApiProviderModal();
            this.loadProviders();
            alert('API提供方保存成功');
        } catch (error) {
            this.logger.logApiError('POST', url, error);
            alert('保存API提供方失败');
        }
    }

    async fetchModels() {
        const apiUrl = document.getElementById('providerApiUrl').value.trim();
        const apiKey = document.getElementById('providerApiKey').value;

        if (!apiUrl || !apiKey) {
            alert('请先填写API地址和密钥');
            return;
        }

        const fetchBtn = document.getElementById('fetchModelsBtn');
        const originalText = fetchBtn.innerHTML;
        fetchBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> 获取中...';
        fetchBtn.disabled = true;

        const url = '/api/providers/models';
        this.logger.logApiCall('POST', url, { body: { api_url: apiUrl } });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_url: apiUrl, api_key: apiKey })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                this.logger.logApiError('POST', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('POST', url, new Error(data.error || `HTTP ${response.status}`), response, data);
                alert(data.error || '获取模型列表失败，请检查API地址和密钥');
                return;
            }

            this.logger.logApiSuccess('POST', url, response, data);

            if (data.models && data.models.length > 0) {
                this.logger.logInfo('模型获取', `成功获取${data.models.length}个模型`, { 
                    modelCount: data.models.length,
                    apiUrl: apiUrl 
                });
                document.getElementById('availableModels').value = data.models.join(', ');
                alert(`成功获取 ${data.models.length} 个模型`);
            } else {
                this.logger.logWarn('模型获取', '未获取到模型列表', { apiUrl: apiUrl });
                alert('未获取到模型列表，请手动输入');
            }
        } catch (error) {
            this.logger.logApiError('POST', url, error);
            alert('获取模型列表失败');
        } finally {
            fetchBtn.innerHTML = originalText;
            fetchBtn.disabled = false;
        }
    }

    async loadProviders() {
        const url = '/api/providers';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let providers;
            try {
                providers = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                return;
            }

            this.logger.logApiSuccess('GET', url, response, providers);
            this.logger.logInfo('数据加载', `成功加载${providers.length}个API提供方`, { count: providers.length });
            
            this.providers = providers;
            this.renderProviders(providers);
            this.updateModelProviderSelect(providers);
        } catch (error) {
            this.logger.logDataLoadError('API提供方列表', error, url);
        }
    }

    renderProviders(providers) {
        const container = document.getElementById('providerList');

        if (providers.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无API提供方</div>';
            return;
        }

        container.innerHTML = providers.map(provider => {
            const models = provider.models ? provider.models.split(',').map(m => m.trim()) : [];
            const modelsHtml = models.map(model => `<span class="model-tag">${model}</span>`).join('');

            return `
                <div class="provider-item">
                    <div class="provider-info">
                        <div class="provider-name">${provider.name}</div>
                        <div class="provider-url">${provider.api_url}</div>
                        <div class="provider-models">${modelsHtml}</div>
                    </div>
                    <div class="provider-actions">
                        <span class="provider-delete" onclick="app.deleteProvider(${provider.id})" title="删除">
                            <i class="bi bi-trash"></i>
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateModelProviderSelect(providers) {
        const select = document.getElementById('modelProvider');
        const currentValue = select.value;

        select.innerHTML = '<option value="">请选择API提供方</option>';
        providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.name;
            select.appendChild(option);
        });

        // Restore previous selection if still exists
        if (currentValue && providers.find(p => p.id == currentValue)) {
            select.value = currentValue;
            this.updateModelOptions(currentValue);
        }
    }

    updateModelOptions(providerId) {
        const modelSelect = document.getElementById('modelIdentifier');
        const providerSelect = document.getElementById('modelProvider');

        if (!providerId) {
            modelSelect.innerHTML = '<option value="">请选择API提供方</option>';
            return;
        }

        // Find the selected provider
        const provider = this.providers?.find(p => p.id == providerId);
        if (!provider || !provider.models) {
            modelSelect.innerHTML = '<option value="">该提供方暂无模型</option>';
            return;
        }

        const models = provider.models.split(',').map(m => m.trim()).filter(m => m);
        modelSelect.innerHTML = '<option value="">请选择模型</option>';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }

    async deleteProvider(providerId) {
        if (!confirm('确定要删除这个API提供方吗？')) return;

        const url = `/api/providers/${providerId}`;
        this.logger.logApiCall('DELETE', url);

        try {
            const response = await fetch(url, {
                method: 'DELETE'
            });

            let result;
            try {
                result = await response.json().catch(() => ({}));
            } catch (parseError) {
                // DELETE可能没有响应体，忽略解析错误
            }

            if (!response.ok) {
                this.logger.logApiError('DELETE', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '删除API提供方失败');
                return;
            }

            this.logger.logApiSuccess('DELETE', url, response);
            this.logger.logInfo('API提供方', 'API提供方删除成功', { providerId: providerId });
            this.loadProviders();
        } catch (error) {
            this.logger.logApiError('DELETE', url, error);
            alert('删除API提供方失败');
        }
    }

    showModal() {
        this.loadProviders().then(() => {
            document.getElementById('addModelModal').classList.add('show');
        });
    }

    hideModal() {
        document.getElementById('addModelModal').classList.remove('show');
    }

    async submitModel() {
        const providerId = document.getElementById('modelProvider').value;
        const modelName = document.getElementById('modelIdentifier').value;
        const displayName = document.getElementById('modelName').value.trim();
        const initialCapital = parseFloat(document.getElementById('initialCapital').value);

        if (!providerId || !modelName || !displayName) {
            alert('请填写所有必填字段');
            return;
        }

        const url = '/api/models';
        const requestData = {
            provider_id: providerId,
            model_name: modelName,
            name: displayName,
            initial_capital: initialCapital
        };
        this.logger.logApiCall('POST', url, { body: requestData });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                this.logger.logApiError('POST', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('POST', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '添加模型失败');
                return;
            }

            this.logger.logApiSuccess('POST', url, response, result);
            this.logger.logInfo('模型管理', '模型添加成功', { 
                modelId: result.id,
                modelName: displayName 
            });

            this.hideModal();
            this.loadModels();
            this.clearForm();
        } catch (error) {
            this.logger.logApiError('POST', url, error);
            alert('添加模型失败');
        }
    }

    async deleteModel(modelId) {
        if (!confirm('确定要删除这个模型吗？')) return;

        const url = `/api/models/${modelId}`;
        this.logger.logApiCall('DELETE', url);

        try {
            const response = await fetch(url, {
                method: 'DELETE'
            });

            let result;
            try {
                result = await response.json().catch(() => ({}));
            } catch (parseError) {
                // DELETE可能没有响应体，忽略解析错误
            }

            if (!response.ok) {
                this.logger.logApiError('DELETE', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '删除模型失败');
                return;
            }

            this.logger.logApiSuccess('DELETE', url, response);
            this.logger.logInfo('模型管理', '模型删除成功', { modelId: modelId });

            if (this.currentModelId === modelId) {
                this.currentModelId = null;
                this.showAggregatedView();
            } else {
                this.loadModels();
            }
        } catch (error) {
            this.logger.logApiError('DELETE', url, error);
            alert('删除模型失败');
        }
    }

    clearForm() {
        document.getElementById('modelProvider').value = '';
        document.getElementById('modelIdentifier').value = '';
        document.getElementById('modelName').value = '';
        document.getElementById('initialCapital').value = '100000';
    }

    async refresh() {
        await Promise.all([
            this.loadModels(),
            this.loadMarketPrices(),
            this.isAggregatedView ? this.loadAggregatedData() : this.loadModelData()
        ]);
    }

    startRefreshCycles() {
        this.refreshIntervals.market = setInterval(() => {
            this.loadMarketPrices();
        }, 5000);

        this.refreshIntervals.portfolio = setInterval(() => {
            if (this.isAggregatedView || this.currentModelId) {
                if (this.isAggregatedView) {
                    this.loadAggregatedData();
                } else {
                    this.loadModelData();
                }
            }
        }, 10000);
    }

    stopRefreshCycles() {
        Object.values(this.refreshIntervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }

    async showSettingsModal() {
        const url = '/api/settings';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let settings;
            try {
                settings = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            this.logger.logApiSuccess('GET', url, response);

            document.getElementById('tradingFrequency').value = settings.trading_frequency_minutes;
            document.getElementById('tradingFeeRate').value = settings.trading_fee_rate;
            const toggle = document.getElementById('showSystemPrompt');
            if (toggle) {
                toggle.checked = Boolean(settings.show_system_prompt);
            }

            // Load time range settings
            const autoTradingStart = document.getElementById('autoTradingStart');
            const autoTradingEnd = document.getElementById('autoTradingEnd');
            if (autoTradingStart && settings.auto_trading_start) {
                // Convert HH:MM:SS to HH:MM format for time input
                const startTime = settings.auto_trading_start.substring(0, 5);
                autoTradingStart.value = startTime;
            }
            if (autoTradingEnd && settings.auto_trading_end) {
                // Convert HH:MM:SS to HH:MM format for time input
                const endTime = settings.auto_trading_end.substring(0, 5);
                autoTradingEnd.value = endTime;
            }

            document.getElementById('settingsModal').classList.add('show');
        } catch (error) {
            this.logger.logDataLoadError('设置', error, url);
            alert('加载设置失败');
        }
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.remove('show');
    }

    showCoinModal() {
        this.loadCoins();
        document.getElementById('coinConfigModal').classList.add('show');
    }

    hideCoinModal() {
        document.getElementById('coinConfigModal').classList.remove('show');
        this.clearCoinForm();
    }

    clearCoinForm() {
        document.getElementById('coinSymbol').value = '';
        document.getElementById('coinName').value = '';
        document.getElementById('coinExchange').value = '';
        document.getElementById('coinCoingeckoId').value = '';
    }

    async loadCoins() {
        const url = '/api/coins';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let coins;
            try {
                coins = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                return;
            }

            this.logger.logApiSuccess('GET', url, response, coins);
            this.logger.logInfo('数据加载', `成功加载${coins.length}个虚拟币配置`, { count: coins.length });
            
            this.renderCoins(coins);
        } catch (error) {
            this.logger.logDataLoadError('虚拟币配置', error, url);
        }
    }

    renderCoins(coins) {
        const container = document.getElementById('coinList');
        if (!coins || coins.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无虚拟币配置</div>';
            return;
        }

        container.innerHTML = coins.map(coin => `
            <div class="provider-item">
                <div class="provider-info">
                    <div class="provider-name">${coin.symbol} - ${coin.name}</div>
                    <div class="provider-url">${coin.exchange} / ${coin.coingecko_id}</div>
                </div>
                <div class="provider-actions">
                    <span class="provider-delete" onclick="app.deleteCoin(${coin.id})" title="删除">
                        <i class="bi bi-trash"></i>
                    </span>
                </div>
            </div>
        `).join('');
    }

    async saveCoin() {
        const data = {
            symbol: document.getElementById('coinSymbol').value.trim(),
            name: document.getElementById('coinName').value.trim(),
            exchange: document.getElementById('coinExchange').value.trim(),
            coingecko_id: document.getElementById('coinCoingeckoId').value.trim()
        };

        if (!data.symbol || !data.name || !data.exchange || !data.coingecko_id) {
            alert('请填写所有虚拟币字段');
            return;
        }

        const url = '/api/coins';
        this.logger.logApiCall('POST', url, { body: data });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                this.logger.logApiError('POST', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('POST', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '保存虚拟币失败');
                return;
            }

            this.logger.logApiSuccess('POST', url, response, result);
            this.logger.logInfo('虚拟币配置', '虚拟币保存成功', { 
                coinId: result.id,
                symbol: data.symbol 
            });

            this.clearCoinForm();
            this.loadCoins();
            this.refresh();
            alert('虚拟币保存成功');
        } catch (error) {
            this.logger.logApiError('POST', url, error);
            alert('保存虚拟币失败');
        }
    }

    async deleteCoin(coinId) {
        if (!confirm('确定要删除该虚拟币吗？')) return;

        const url = `/api/coins/${coinId}`;
        this.logger.logApiCall('DELETE', url);

        try {
            const response = await fetch(url, {
                method: 'DELETE'
            });

            let result;
            try {
                result = await response.json().catch(() => ({}));
            } catch (parseError) {
                // DELETE可能没有响应体，忽略解析错误
            }

            if (!response.ok) {
                this.logger.logApiError('DELETE', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '删除虚拟币失败');
                return;
            }

            this.logger.logApiSuccess('DELETE', url, response);
            this.logger.logInfo('虚拟币配置', '虚拟币删除成功', { coinId: coinId });

            this.loadCoins();
            this.refresh();
        } catch (error) {
            this.logger.logApiError('DELETE', url, error);
            alert('删除虚拟币失败');
        }
    }

    async saveSettings() {
        const tradingFrequency = parseInt(document.getElementById('tradingFrequency').value);
        const tradingFeeRate = parseFloat(document.getElementById('tradingFeeRate').value);
        const showSystemPrompt = document.getElementById('showSystemPrompt').checked;
        let autoTradingStart = document.getElementById('autoTradingStart').value;
        let autoTradingEnd = document.getElementById('autoTradingEnd').value;
        
        // Convert HH:MM to HH:MM:SS format for database
        if (autoTradingStart && autoTradingStart.length === 5) {
            autoTradingStart = autoTradingStart + ':00';
        }
        if (autoTradingEnd && autoTradingEnd.length === 5) {
            autoTradingEnd = autoTradingEnd + ':00';
        }

        if (!tradingFrequency || tradingFrequency < 1 || tradingFrequency > 1440) {
            alert('请输入有效的交易频率（1-1440分钟）');
            return;
        }

        if (tradingFeeRate < 0 || tradingFeeRate > 0.01) {
            alert('请输入有效的交易费率（0-0.01）');
            return;
        }

        if (!autoTradingStart || !autoTradingEnd) {
            alert('请设置自动执行时间范围');
            return;
        }

        const url = '/api/settings';
        const requestData = {
            trading_frequency_minutes: tradingFrequency,
            trading_fee_rate: tradingFeeRate,
            show_system_prompt: showSystemPrompt,
            auto_trading_start: autoTradingStart,
            auto_trading_end: autoTradingEnd
        };
        this.logger.logApiCall('PUT', url, { body: requestData });

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                this.logger.logApiError('PUT', url, new Error('响应解析失败'), response);
                alert('响应解析失败，请稍后再试');
                return;
            }

            if (!response.ok) {
                this.logger.logApiError('PUT', url, new Error(result.error || `HTTP ${response.status}`), response, result);
                alert(result.error || '保存设置失败');
                return;
            }

            this.logger.logApiSuccess('PUT', url, response, result);
            this.logger.logInfo('设置', '设置保存成功', requestData);

            this.hideSettingsModal();
            this.showSystemPrompt = showSystemPrompt;
            this.loadSettingsCache();
            alert('设置保存成功');
        } catch (error) {
            this.logger.logApiError('PUT', url, error);
            alert('保存设置失败');
        }
    }

    // ============ Update Check Methods ============

    async checkForUpdates(silent = false) {
        const url = '/api/check-update';
        this.logger.logApiCall('GET', url);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                this.logger.logApiError('GET', url, new Error('响应解析失败'), response);
                if (!silent) {
                    alert('检查更新失败，请稍后重试');
                }
                return;
            }

            this.logger.logApiSuccess('GET', url, response, data);

            if (data.update_available) {
                this.logger.logInfo('更新检查', '发现新版本', { 
                    currentVersion: data.current_version,
                    latestVersion: data.latest_version 
                });
                this.showUpdateModal(data);
                this.showUpdateIndicator();
            } else if (!silent) {
                if (data.error) {
                    this.logger.logWarn('更新检查', `更新检查失败: ${data.error}`);
                } else {
                    this.logger.logInfo('更新检查', '已是最新版本');
                    // Already on latest version
                    this.showUpdateIndicator(true);
                    setTimeout(() => this.hideUpdateIndicator(), 2000);
                }
            }
        } catch (error) {
            this.logger.logApiError('GET', url, error);
            if (!silent) {
                alert('检查更新失败，请稍后重试');
            }
        }
    }

    showUpdateModal(data) {
        const modal = document.getElementById('updateModal');
        const currentVersion = document.getElementById('currentVersion');
        const latestVersion = document.getElementById('latestVersion');
        const releaseNotes = document.getElementById('releaseNotes');
        const githubLink = document.getElementById('githubLink');

        currentVersion.textContent = `v${data.current_version}`;
        latestVersion.textContent = `v${data.latest_version}`;
        githubLink.href = data.release_url || data.repo_url;

        // Format release notes
        if (data.release_notes) {
            releaseNotes.innerHTML = this.formatReleaseNotes(data.release_notes);
        } else {
            releaseNotes.innerHTML = '<p>暂无更新说明</p>';
        }

        modal.classList.add('show');
    }

    hideUpdateModal() {
        document.getElementById('updateModal').classList.remove('show');
    }

    dismissUpdate() {
        this.hideUpdateModal();
        // Hide indicator temporarily, check again in 24 hours
        this.hideUpdateIndicator();

        // Store dismissal timestamp in localStorage
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        localStorage.setItem('updateDismissedUntil', tomorrow.getTime().toString());
    }

    formatReleaseNotes(notes) {
        // Simple markdown-like formatting
        let formatted = notes
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/# (.*)/g, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/^-\s+(.*)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)/, '<p>$1')
            .replace(/(.*)$/, '$1</p>');

        // Clean up extra <p> tags around block elements
        formatted = formatted.replace(/<p>(<h\d+>.*<\/h\d+>)<\/p>/g, '$1');
        formatted = formatted.replace(/<p>(<ul>.*<\/ul>)<\/p>/g, '$1');

        return formatted;
    }

    showUpdateIndicator() {
        const indicator = document.getElementById('updateIndicator');
        // Check if dismissed recently
        const dismissedUntil = localStorage.getItem('updateDismissedUntil');
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
            return;
        }
        indicator.style.display = 'block';
    }

    hideUpdateIndicator() {
        const indicator = document.getElementById('updateIndicator');
        indicator.style.display = 'none';
    }
}

const app = new TradingApp();