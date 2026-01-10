export const generateHTML = (
    data: any, 
    range: string, 
    themeColor: string, 
    userName: string, 
    aiAdvice: string,
    budgetData?: any
) => {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // --- 1. CALCULATIONS ---
    const monthlyBudget = budgetData?.monthlyLimit || 0;
    const budgetRemaining = Math.max(0, monthlyBudget - data.stats.expense);
    const budgetUtilization = monthlyBudget > 0 ? Math.round((data.stats.expense / monthlyBudget) * 100) : 0;
    
    const dailyAverage = budgetData?.dailyAverage || 0;
    const daysLeft = budgetData?.daysLeftInMonth || 0;
    const willExceed = budgetData?.willExceed || false;
    const budgetStyle = budgetData?.budgetStyle || "Flexible";
    
    // --- 2. THEME CONFIG ---
    const BG_COLOR = "#ffffff";
    const TEXT_COLOR = "#1f2937";
    const MUTED_COLOR = "#6b7280"; 
    const BORDER_COLOR = "#e5e7eb";
    const CARD_BG = "#f9fafb";
    
    const INCOME_COLOR = "#059669"; 
    const EXPENSE_COLOR = "#dc2626"; 
    const SAVING_COLOR = "#2563eb"; 
    const WARNING_BG = "#fef2f2";
    const WARNING_BORDER = "#fecaca";
    const SUCCESS_BG = "#f0fdf4";
    const SUCCESS_BORDER = "#86efac";
    
    // --- 3. GENERATE VISUALIZATIONS ---
    const topCategories = data.categories.slice(0, 5);
    const maxCategoryAmount = topCategories.length > 0 ? topCategories[0].amount : 1;
    
    const categoryBars = topCategories.map((cat: any) => {
        const percentage = (cat.amount / maxCategoryAmount) * 100;
        const barWidth = Math.max(percentage, 5);
        return `
            <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="font-size: 13px; color: ${TEXT_COLOR};">${cat.label}</strong>
                    <span style="font-weight: bold; color: ${TEXT_COLOR};">₹${cat.amount.toLocaleString()}</span>
                </div>
                <div style="background: ${BORDER_COLOR}; border-radius: 6px; height: 10px; overflow: hidden;">
                    <div style="background: ${cat.color || themeColor}; width: ${barWidth}%; height: 100%; border-radius: 6px;"></div>
                </div>
            </div>
        `;
    }).join('');
    
    const txRows = data.displayTxs.slice(0, 50).map((t: any) => `
        <tr style="border-bottom: 1px solid ${BORDER_COLOR};">
            <td style="padding: 12px 8px; color: ${MUTED_COLOR}; font-size: 12px;">${new Date(t.date).toLocaleDateString()}</td>
            <td style="padding: 12px 8px;"><strong style="color: ${TEXT_COLOR}; font-size: 13px;">${t.category?.label || 'General'}</strong></td>
            <td style="padding: 12px 8px; color: ${MUTED_COLOR}; font-size: 13px;">${t.note || '-'}</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: ${t.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR}; font-size: 13px;">
                ${t.type === 'income' ? '+' : '-'}₹${Number(t.amount).toLocaleString()}
            </td>
        </tr>
    `).join('');

    // --- 4. HTML STRUCTURE ---
    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; padding: 40px; color: ${TEXT_COLOR}; background: ${BG_COLOR}; }
          
          /* Header */
          .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid ${themeColor}; }
          .brand { font-size: 11px; color: ${MUTED_COLOR}; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; }
          .title { font-size: 38px; font-weight: 800; color: ${TEXT_COLOR}; letter-spacing: -1px; margin: 0; }
          .subtitle { font-size: 15px; color: ${MUTED_COLOR}; margin-top: 5px; }
          
          /* Meta Grid */
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 35px; background: ${CARD_BG}; padding: 15px 20px; border-radius: 10px; border: 1px solid ${BORDER_COLOR}; }
          .meta-item { text-align: left; }
          .meta-label { font-size: 10px; text-transform: uppercase; color: ${MUTED_COLOR}; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
          .meta-value { font-size: 15px; font-weight: 700; color: ${TEXT_COLOR}; }

          /* Cards */
          .cards-grid { display: flex; gap: 15px; margin-bottom: 30px; }
          .card { flex: 1; padding: 20px; background: ${CARD_BG}; border-radius: 12px; text-align: center; border: 1px solid ${BORDER_COLOR}; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }
          .card h3 { margin: 0; font-size: 11px; color: ${MUTED_COLOR}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
          .card p { margin: 8px 0 0; font-size: 24px; font-weight: 800; color: ${TEXT_COLOR}; }
          
          /* Budget Box */
          .budget-box { background: ${CARD_BG}; border: 1px solid ${BORDER_COLOR}; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
          .budget-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
          .budget-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${MUTED_COLOR}; letter-spacing: 1px; }
          .budget-percent { font-size: 24px; font-weight: 800; color: ${TEXT_COLOR}; }
          .budget-progress { height: 8px; background: ${BORDER_COLOR}; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
          
          .metrics-grid { display: flex; gap: 10px; }
          .metric { flex: 1; background: ${BG_COLOR}; padding: 10px; border-radius: 8px; border: 1px solid ${BORDER_COLOR}; }
          .metric-label { font-size: 10px; text-transform: uppercase; color: ${MUTED_COLOR}; font-weight: 600; }
          .metric-val { font-size: 14px; font-weight: 700; color: ${TEXT_COLOR}; margin-top: 4px; }

          .alert { margin-top: 15px; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 500; background: ${willExceed ? WARNING_BG : SUCCESS_BG}; border: 1px solid ${willExceed ? WARNING_BORDER : SUCCESS_BORDER}; color: ${willExceed ? '#991b1b' : '#166534'}; }

          /* AI Section */
          .ai-section { 
            background: #eff6ff; 
            border-left: 4px solid ${themeColor}; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 35px; 
            page-break-inside: avoid; /* Keep AI Together */
          }
          .ai-title { font-weight: 800; color: ${themeColor}; margin-bottom: 8px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
          .ai-text { color: #1e3a8a; font-style: italic; font-size: 14px; line-height: 1.6; }

          /* ✅ SECTION CONTAINER (Prevents splitting) */
          .section-container { 
            margin-bottom: 40px; 
            page-break-inside: avoid; /* Don't split this block */
            break-inside: avoid; /* Newer syntax */
          }

          /* Tables */
          h3 { font-size: 14px; margin-bottom: 15px; color: ${TEXT_COLOR}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; border-bottom: 1px solid ${BORDER_COLOR}; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: ${MUTED_COLOR}; border-bottom: 1.5px solid ${BORDER_COLOR}; }
          
          /* Footer */
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: ${MUTED_COLOR}; padding-top: 20px; border-top: 1px dashed ${BORDER_COLOR}; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">INSPEND REPORT</div>
          <div class="title">Financial Summary</div>
          <div class="subtitle">Prepared for <strong>${userName}</strong> on ${dateStr}</div>
        </div>

        <div class="meta-grid">
            <div class="meta-item"><div class="meta-label">Date Range</div><div class="meta-value">${range.toUpperCase()}</div></div>
            <div class="meta-item"><div class="meta-label">Budget Style</div><div class="meta-value">${budgetStyle}</div></div>
            <div class="meta-item"><div class="meta-label">Transactions</div><div class="meta-value">${data.displayTxs.length}</div></div>
        </div>

        <div class="cards-grid">
          <div class="card"><h3>Total Income</h3><p style="color: ${INCOME_COLOR}">₹${data.stats.income.toLocaleString()}</p></div>
          <div class="card"><h3>Total Expense</h3><p style="color: ${EXPENSE_COLOR}">₹${data.stats.expense.toLocaleString()}</p></div>
          <div class="card"><h3>Net Balance</h3><p style="color: ${data.stats.net >= 0 ? SAVING_COLOR : EXPENSE_COLOR}">₹${data.stats.net.toLocaleString()}</p></div>
        </div>

        ${monthlyBudget > 0 ? `
        <div class="budget-box">
            <div class="budget-header"><div class="budget-title">Budget Utilization</div><div class="budget-percent">${budgetUtilization}% <span style="font-size:14px; color:${MUTED_COLOR}; font-weight:500;">used</span></div></div>
            <div class="budget-progress"><div style="width: ${Math.min(budgetUtilization, 100)}%; background: ${willExceed ? EXPENSE_COLOR : themeColor}; height: 100%;"></div></div>
            <div class="metrics-grid">
                <div class="metric"><div class="metric-label">Monthly Limit</div><div class="metric-val">₹${monthlyBudget.toLocaleString()}</div></div>
                <div class="metric"><div class="metric-label">Remaining</div><div class="metric-val" style="color: ${budgetRemaining < 0 ? EXPENSE_COLOR : INCOME_COLOR}">₹${budgetRemaining.toLocaleString()}</div></div>
                <div class="metric"><div class="metric-label">Daily Avg</div><div class="metric-val">₹${dailyAverage.toLocaleString()}</div></div>
                <div class="metric"><div class="metric-label">Days Left</div><div class="metric-val">${daysLeft}</div></div>
            </div>
            <div class="alert">${willExceed ? '⚠️ <strong>Warning:</strong> You are spending faster than your budget allows.' : '✅ <strong>Great!</strong> You are well within your spending limits.'}</div>
        </div>
        ` : ''}

        <div class="ai-section">
            <div class="ai-title">🤖 Axiom's Insight</div>
            <div class="ai-text">"${aiAdvice}"</div>
        </div>

        <div class="section-container">
            <h3>Top Spending Categories</h3>
            ${categoryBars}
        </div>

        <div class="section-container">
            <h3>Recent Activity</h3>
            <table>
                <tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align: right;">Amount</th></tr>
                ${txRows}
            </table>
        </div>

        <div class="footer">
          Generated by InSpend • Master your money, one pixel at a time.
        </div>
      </body>
    </html>
    `;
};