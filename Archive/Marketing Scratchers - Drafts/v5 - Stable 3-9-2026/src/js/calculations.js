export function calculateGameMetrics(game, state) {
    const scenario = state.scenarios.find(s => s.id === state.activeScenarioId);
    if (!scenario) return { revenue: 0, contractCost: 0, prizeExpense: 0, cogs: 0, grossMargin: 0 };
    const denom = scenario.denominations.find(d => d.price === game.denominationPrice);
    if (!denom) return { revenue: 0, contractCost: 0, prizeExpense: 0, cogs: 0, grossMargin: 0 };

    // Apply Sell-through % to revenue
    const sellThrough = (state.sellThroughPercent ?? 100) / 100;
    const revenue = (game.units * sellThrough) * denom.price;

    const vendor = state.vendorPricing[game.vendorId] || {};
    const baseCostValue = vendor.baseCosts?.[game.denominationPrice] ?? (vendor.baseCostValue ?? 0);

    let manufacturing = 0;
    // Manufacturing cost is based on TOTAL units, not sell-through units
    if (vendor.costModel === 'perThousand') manufacturing = (game.units / 1000) * baseCostValue;
    else manufacturing = revenue * (baseCostValue / 100);

    let featureCost = (game.featureIds || []).reduce((sum, name) => {
        return sum + (game.units / 1000) * (vendor.features[name] || 0);
    }, 0);

    const contractCost = manufacturing + featureCost;
    const prizeExpense = revenue * (game.payoutPercent / 100);

    // Add Retailer Commission and Admin Expense to COGS
    const retailerCommission = revenue * ((state.retailerCommissionPercent ?? 0) / 100);
    const adminExpense = revenue * ((state.administrativeExpensePercent ?? 0) / 100);
    const cogs = contractCost + prizeExpense + retailerCommission + adminExpense;
    const grossMargin = revenue - cogs;

    return { revenue, contractCost, prizeExpense, cogs, grossMargin };
}
