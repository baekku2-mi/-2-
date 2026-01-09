import React, { useState, useEffect } from 'react';
import InputGroup from './components/InputGroup';
import ResultCard from './components/ResultCard';
import { CalculationInputs, CalculationResult, AdviceStatus, CalculationMode, PeriodInputMode } from './types';
import { getFinancialAdvice, searchApartmentTotalArea } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [inputs, setInputs] = useState<CalculationInputs>({
    mode: 'RATE',
    periodInputMode: 'DURATION',
    periodAmount: 0,
    totalRepairCost: 0,
    accumulationRate: 0,
    durationMonths: 60, // Default 5 years * 12
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 4,
    totalComplexArea: 0,
    householdArea: 0,
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [advice, setAdvice] = useState<string>('');
  const [adviceStatus, setAdviceStatus] = useState<AdviceStatus>(AdviceStatus.IDLE);
  
  // Search States
  const [aptName, setAptName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchSources, setSearchSources] = useState<{title: string, uri: string}[]>([]);
  const [searchMessage, setSearchMessage] = useState('');

  useEffect(() => {
    calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const handleInputChange = (field: keyof CalculationInputs, value: any) => {
    setInputs(prev => {
      const newInputs = {
        ...prev,
        [field]: value
      };

      // If duration changes (in Duration mode), sync end year for consistency
      // if user switches back to Range mode later.
      if (field === 'durationMonths') {
          const durationInYears = Math.max(1, Math.round(value / 12));
          if (newInputs.startYear) {
              newInputs.endYear = newInputs.startYear + durationInYears - 1;
          }
      }
      return newInputs;
    });
  };

  const handlePeriodRangeChange = (type: 'start' | 'end', year: number) => {
    setInputs(prev => {
      const newInputs = { ...prev };
      let newStart = prev.startYear || new Date().getFullYear();
      let newEnd = prev.endYear || newStart;

      if (type === 'start') {
        newStart = year;
        // If start > end, pull end to start to prevent negative duration
        if (newStart > newEnd) {
             newEnd = newStart;
        }
      } else {
        newEnd = year;
        // If end < start, pull start to end to prevent negative duration
        if (newEnd < newStart) {
            newStart = newEnd;
        }
      }

      newInputs.startYear = newStart;
      newInputs.endYear = newEnd;
      
      // Independent calculation: Duration is simply the inclusive difference in months
      newInputs.durationMonths = (newEnd - newStart + 1) * 12;

      return newInputs;
    });
  };
  
  const handleAptSearch = async () => {
    if (!aptName.trim()) {
        setSearchMessage('아파트 단지명을 입력해주세요.');
        return;
    }
    
    setIsSearching(true);
    setSearchMessage('');
    setSearchSources([]);
    
    try {
        const { totalArea, householdArea, found, sources } = await searchApartmentTotalArea(aptName);
        setSearchSources(sources);
        
        let message = '';
        let successCount = 0;

        if (found) {
            if (totalArea > 0) {
                handleInputChange('totalComplexArea', totalArea);
                successCount++;
            }
            if (householdArea > 0) {
                handleInputChange('householdArea', householdArea);
                successCount++;
            }
        }

        if (successCount === 2) {
            message = `검색 성공! 총 공급면적과 세대 면적(${householdArea}m²)이 입력되었습니다.`;
            setSearchMessage(message);
        } else if (successCount === 1) {
             if (totalArea > 0) {
                 message = `총 공급면적만 확인되었습니다. 세대 면적은 직접 입력해주세요.`;
             } else {
                 message = `세대 면적만 확인되었습니다. 총 공급면적은 직접 입력해주세요.`;
             }
             setSearchMessage(message);
        } else {
            setSearchMessage('정확한 면적 정보를 찾지 못했습니다. 아래 K-Apt 링크에서 확인 후 직접 입력해주세요.');
        }

    } catch (e) {
        setSearchMessage('검색 중 오류가 발생했습니다.');
    } finally {
        setIsSearching(false);
    }
  };

  const calculate = () => {
    const { mode, periodAmount, totalRepairCost, accumulationRate, durationMonths, totalComplexArea, householdArea } = inputs;

    // Common validation
    if (durationMonths <= 0 || totalComplexArea <= 0 || householdArea <= 0) {
      setResult(null);
      return;
    }

    let periodTargetAmount = 0;

    if (mode === 'RATE') {
      if (totalRepairCost <= 0 || accumulationRate <= 0) {
        setResult(null);
        return;
      }
      // Mode RATE: Total Plan Cost * (Rate / 100)
      periodTargetAmount = totalRepairCost * (accumulationRate / 100);
    } else {
      if (periodAmount <= 0) {
        setResult(null);
        return;
      }
      // Mode AMOUNT: Direct Input
      periodTargetAmount = periodAmount;
    }

    // Common Calculation Logic
    // 2. Monthly Target for the whole complex
    // Period Target / Duration in Months
    const monthlyTotalTarget = periodTargetAmount / durationMonths;

    // 3. Monthly Rate per Square Meter
    // Monthly Target / Total Area
    const monthlyRatePerSqm = monthlyTotalTarget / totalComplexArea;

    // 4. Individual Household Fee
    // Rate per Sqm * Household Area
    const householdMonthlyFee = monthlyRatePerSqm * householdArea;

    setResult({
      periodTargetAmount,
      monthlyTotalTarget,
      monthlyRatePerSqm,
      householdMonthlyFee
    });
  };

  const handleConsultAI = async () => {
    if (!result) return;
    
    setAdviceStatus(AdviceStatus.LOADING);
    setAdvice('');
    
    try {
      const adviceText = await getFinancialAdvice(inputs, result);
      setAdvice(adviceText);
      setAdviceStatus(AdviceStatus.SUCCESS);
    } catch (error) {
      setAdvice('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setAdviceStatus(AdviceStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-2">
            장기수선충당금 적립현황
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            주택관리규약에 따른 적립 요율 또는 계획 금액을 기반으로 우리 집의 장기수선충당금을 미리 계산해보세요.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="mb-6 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">장기수선충당금 산출 정보</h2>
              <p className="text-sm text-slate-500 mt-1">
                관리소 또는 장기수선계획서를 참고하여 입력해주세요.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">계산 기준 선택</label>
              <div className="bg-slate-100 p-1 rounded-lg flex">
                <button
                  type="button"
                  onClick={() => handleInputChange('mode', 'RATE')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    inputs.mode === 'RATE'
                      ? 'bg-white text-indigo-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  해당기간 적립요율
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('mode', 'AMOUNT')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    inputs.mode === 'AMOUNT'
                      ? 'bg-white text-indigo-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  해당 적용기간 금액
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {inputs.mode === 'RATE' ? (
                <>
                  <InputGroup
                    label="장기수선계획 총 수선비"
                    subLabel="계획 기간(보통 40~60년) 동안 소요되는 총 예상 비용"
                    unit="원"
                    value={inputs.totalRepairCost}
                    onChange={(val) => handleInputChange('totalRepairCost', val)}
                    placeholder="예: 10,000,000,000"
                  />
                  <InputGroup
                    label="해당기간 적립 요율"
                    subLabel="전체 계획 대비 해당 기간의 적립 비율"
                    unit="%"
                    value={inputs.accumulationRate}
                    onChange={(val) => handleInputChange('accumulationRate', val)}
                    placeholder="예: 20"
                  />
                </>
              ) : (
                <InputGroup
                  label="해당 적용기간 적립 총액"
                  subLabel="설정된 기간 동안 적립하기로 계획된 총 금액"
                  unit="원"
                  value={inputs.periodAmount}
                  onChange={(val) => handleInputChange('periodAmount', val)}
                  placeholder="예: 2,000,000,000"
                />
              )}

              {/* Period Selection Section */}
              <div className="mb-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2 mt-2">
                   <label className="block text-sm font-medium text-slate-700">적용 기간 설정</label>
                   <div className="flex bg-slate-100 rounded p-0.5">
                      <button
                        onClick={() => handleInputChange('periodInputMode', 'DURATION')}
                        className={`text-xs px-2 py-1 rounded ${inputs.periodInputMode === 'DURATION' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                      >
                        단순 개월 입력
                      </button>
                      <button
                        onClick={() => handleInputChange('periodInputMode', 'RANGE')}
                        className={`text-xs px-2 py-1 rounded ${inputs.periodInputMode === 'RANGE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                      >
                        적립 기간(년도) 설정
                      </button>
                   </div>
                </div>
                
                {inputs.periodInputMode === 'DURATION' ? (
                  <InputGroup
                    label="적용 기간 (개월)"
                    subLabel="위 요율 또는 금액을 적용하는 총 기간"
                    unit="개월"
                    value={inputs.durationMonths}
                    onChange={(val) => handleInputChange('durationMonths', val)}
                    placeholder="예: 60"
                    useCommas={false}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <InputGroup
                          label="시작 연도"
                          unit="년"
                          value={inputs.startYear || 0}
                          onChange={(val) => handlePeriodRangeChange('start', val)}
                          placeholder="2025"
                          useCommas={false}
                       />
                       <InputGroup
                          label="종료 연도"
                          unit="년"
                          value={inputs.endYear || 0}
                          onChange={(val) => handlePeriodRangeChange('end', val)}
                          placeholder="2030"
                          useCommas={false}
                       />
                    </div>
                    {/* Visual feedback for the calculated months */}
                     <div className="bg-slate-50 p-3 rounded-md border border-slate-200 flex justify-between items-center">
                        <div className="text-sm font-medium text-slate-600">
                          <span className="block">자동 산출 기간</span>
                          <span className="text-xs text-slate-400 font-normal">시작~종료 연도 기준 (1년=12개월)</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-indigo-600">{inputs.durationMonths}</span>
                          <span className="text-sm text-slate-500 ml-1">개월</span>
                        </div>
                     </div>
                  </div>
                )}
              </div>

              {/* Apartment Search Section */}
              <div className="border-t border-slate-100 pt-4 mt-4 mb-4">
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-slate-700">아파트 면적 정보 찾기</label>
                    <a 
                      href="https://www.k-apt.go.kr/web/main/index.do" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 font-semibold hover:underline flex items-center"
                    >
                      K-Apt (공동주택관리정보) 바로가기
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input 
                        type="text" 
                        value={aptName}
                        onChange={(e) => setAptName(e.target.value)}
                        placeholder="예: 00동 XX아파트 (평형 포함 검색 권장)"
                        className="flex-1 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                        onKeyDown={(e) => e.key === 'Enter' && handleAptSearch()}
                    />
                    <button
                        onClick={handleAptSearch}
                        disabled={isSearching}
                        className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${isSearching ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {isSearching ? '검색중...' : 'AI 검색'}
                    </button>
                  </div>
                  {searchMessage && (
                      <p className={`text-xs mb-2 ${searchMessage.includes('성공') ? 'text-green-600' : 'text-orange-500'}`}>
                          {searchMessage}
                      </p>
                  )}
                  {searchSources.length > 0 && (
                      <div className="text-xs text-slate-400 mb-4">
                          <span className="mr-1">참조:</span>
                          {searchSources.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="underline mr-2 hover:text-slate-600">
                                  {s.title}
                              </a>
                          ))}
                      </div>
                  )}

                  <InputGroup
                    label="아파트 총 공급면적"
                    subLabel="관리비 부과 대상 전체 면적의 합계"
                    unit="m²"
                    value={inputs.totalComplexArea}
                    onChange={(val) => handleInputChange('totalComplexArea', val)}
                    placeholder="예: 150,000"
                  />

                  <InputGroup
                    label="우리 집 공급면적"
                    subLabel="관리비 고지서 또는 K-Apt에서 확인 가능"
                    unit="m²"
                    value={inputs.householdArea}
                    onChange={(val) => handleInputChange('householdArea', val)}
                    placeholder="예: 84.9"
                  />
              </div>
            </div>
            
            <div className="mt-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
              <p className="font-semibold mb-1">💡 장기수선충당금 산출 공식</p>
              {inputs.mode === 'RATE' ? (
                <p className="opacity-90 leading-relaxed">
                  (수선비 총액 × 적립요율) ÷ (총 공급면적 × 기간(월)) × 세대 공급면적
                </p>
              ) : (
                <p className="opacity-90 leading-relaxed">
                  기간 적립 총액 ÷ (총 공급면적 × 기간(월)) × 세대 공급면적
                </p>
              )}
            </div>
          </div>

          {/* Result Section */}
          <div className="space-y-6">
            <ResultCard 
              result={result} 
              onConsultAI={handleConsultAI}
              isAiLoading={adviceStatus === AdviceStatus.LOADING}
            />

            {/* AI Advice Output */}
            {adviceStatus !== AdviceStatus.IDLE && (
              <div className={`bg-white p-6 rounded-xl shadow-lg border border-purple-100 transition-all duration-500 ${adviceStatus === AdviceStatus.SUCCESS ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 rounded-full">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">AI 분석 리포트</h3>
                </div>
                <div className="prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>{advice}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <footer className="mt-12 text-center text-slate-400 text-sm">
          <p>© 2025 Long-term Repair Allowance Accumulation Status. All rights reserved.</p>
          <p className="mt-1">본 계산 결과는 참고용이며, 실제 관리비 부과 내역과 차이가 있을 수 있습니다.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;