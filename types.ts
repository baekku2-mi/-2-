
export type CalculationMode = 'RATE' | 'AMOUNT';
export type PeriodInputMode = 'DURATION' | 'RANGE';

export interface CalculationInputs {
  mode: CalculationMode;
  periodInputMode: PeriodInputMode; // 년수 입력 vs 기간(연도) 입력
  
  periodAmount: number; // 해당 기간 적립 총액 (원) - AMOUNT 모드일 때 사용
  totalRepairCost: number; // 수선비 총액 (원) - RATE 모드일 때 사용
  accumulationRate: number; // 적립요율 (%) - RATE 모드일 때 사용
  
  durationMonths: number; // 적립 기간 (개월) - 계산의 기준값
  startYear?: number; // 시작 연도 (RANGE 모드)
  endYear?: number; // 종료 연도 (RANGE 모드)
  
  totalComplexArea: number; // 총 공급면적 (m2)
  householdArea: number; // 세대당 공급면적 (m2)
}

export interface CalculationResult {
  monthlyTotalTarget: number; // 단지 전체 월 적립 목표액
  monthlyRatePerSqm: number; // m2당 월 부과액
  householdMonthlyFee: number; // 세대별 월 부과액
  periodTargetAmount: number; // 해당 기간 총 적립 목표액
}

export enum AdviceStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}
