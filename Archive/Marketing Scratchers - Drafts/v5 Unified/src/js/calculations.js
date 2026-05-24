export function calculateGameMetrics(game, state) {
    const scenario = state.scenarios.find(s => s.id === state.activeScenarioId);
    if (!scenario) return { revenue: 0, contractCost: 0, prizeExpense: 0, cogs: 0, grossMargin: 0 };
    const denom = scenario.denominations.find(d => d.price === game.denominationPrice);
    if (!denom) return { revenue: 0, contractCost: 0, prizeExpense: 0, cogs: 0, grossMargin: 0 };

    // Apply Sell-through % to revenue
    const sellThrough = (state.sellThroughPercent ?? 100) / 100;
    const revenue = (game.units * sellThrough) * denom.price;

    const vendor = state.vendorPricing[game.vendorId] || {};

    // Evaluate Tiered Pricing and Linear Interpolation
    const baseCostTiers = vendor.baseCosts?.[game.ticketSize] || [];
    let baseCostValue = vendor.baseCostValue ?? 0; // Fallback for very old unmigrated plans if any slip through

    if (baseCostTiers.length > 0) {
        // Sort tiers by quantity ascending to ensure reliable math
        const sortedTiers = [...baseCostTiers].sort((a, b) => a.quantity - b.quantity);
        const qx = game.units || 0;

        if (qx <= sortedTiers[0].quantity) {
            // Clamp to highest cost if smaller than lowest tier
            baseCostValue = sortedTiers[0].cost;
        } else if (qx >= sortedTiers[sortedTiers.length - 1].quantity) {
            // Clamp to lowest cost if larger than highest tier
            baseCostValue = sortedTiers[sortedTiers.length - 1].cost;
        } else {
            // We fall between two established tiers. Interpolate!
            for (let i = 0; i < sortedTiers.length - 1; i++) {
                const lower = sortedTiers[i];
                const upper = sortedTiers[i + 1];
                if (qx > lower.quantity && qx < upper.quantity) {
                    // Formula: Px = P1 - (((Qx - Q1) / (Q2 - Q1)) * (P1 - P2))
                    const q1 = lower.quantity;
                    const q2 = upper.quantity;
                    const p1 = lower.cost;
                    const p2 = upper.cost;
                    baseCostValue = p1 - (((qx - q1) / (q2 - q1)) * (p1 - p2));
                    break;
                } else if (qx === upper.quantity) {
                    baseCostValue = upper.cost;
                    break;
                }
            }
        }
    }

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

    return { revenue, contractCost, prizeExpense, cogs, grossMargin, baseCostApplied: baseCostValue };
}
