import { addDays, differenceInDays, startOfDay, format, isWithinInterval } from 'date-fns';

export const CYCLE_DAYS = 14;
export const PAY_PERIOD_DAYS = 14;

export interface BudgetCycle {
  id: string;
  startDate: Date;
  endDate: Date;
  payPeriod: {
    startDate: Date;
    endDate: Date;
  };
}

export const getCurrentCycle = (cycleStartDate: Date): BudgetCycle => {
  const now = startOfDay(new Date());
  const daysSinceStart = differenceInDays(now, startOfDay(cycleStartDate));
  const cycleIndex = Math.floor(daysSinceStart / CYCLE_DAYS);
  
  const startDate = addDays(startOfDay(cycleStartDate), cycleIndex * CYCLE_DAYS);
  const endDate = addDays(startDate, CYCLE_DAYS - 1);
  
  return {
    id: format(startDate, 'yyyy-MM-dd'),
    startDate,
    endDate,
    payPeriod: { startDate, endDate },
  };
};

export const getCycleForDate = (date: Date, cycleStartDate: Date): BudgetCycle => {
  const daysSinceStart = differenceInDays(startOfDay(date), startOfDay(cycleStartDate));
  const cycleIndex = Math.floor(daysSinceStart / CYCLE_DAYS);
  
  const startDate = addDays(startOfDay(cycleStartDate), cycleIndex * CYCLE_DAYS);
  const endDate = addDays(startDate, CYCLE_DAYS - 1);
  
  return {
    id: format(startDate, 'yyyy-MM-dd'),
    startDate,
    endDate,
    payPeriod: { startDate, endDate },
  };
};
