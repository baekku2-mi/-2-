import React, { useState } from 'react';
import { CalculationResult } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ResultCardProps {
  result: CalculationResult | null;
  onConsultAI: () => void;
  isAiLoading: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onConsultAI, isAiLoading }) => {
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  if (!result) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex items-center justify-center text-slate-400 text-center">
        <p>왼쪽의 항목을 입력하면<br/>자동으로 계산 결과가 표시됩니다.</p>
      </div>
    );
  }

  const data = [
    { name: '세대부과액', value: result.householdMonthlyFee },
    { name: '기타 비용(예시)', value: result.householdMonthlyFee * 0.2 }, // Dummy for visual
  ];
  const COLORS = ['#6366f1', '#e2e8f0'];

  const handleDownloadPdf = async () => {
    const element = document.getElementById('result-card-container');
    if (!element) return;
    
    setIsPdfGenerating(true);
    
    try {
      // Temporarily hide shadow to make PDF cleaner
      element.classList.remove('shadow-lg');
      
      const canvas = await html2canvas(element, { 
        scale: 2, // Higher resolution
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Restore shadow
      element.classList.add('shadow-lg');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('장기수선충당금_계산결과.pdf');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <div id="result-card-container" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-50">
      <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        계산 결과
      </h2>

      <div className="space-y-6">
        <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
          <p className="text-sm text-indigo-700 font-medium mb-1">우리 집 월 부과 금액</p>
          <div className="text-3xl font-bold text-indigo-900">
            {Math.round(result.householdMonthlyFee).toLocaleString()} <span className="text-lg font-normal">원/월</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">㎡당 월 단가</p>
            <p className="text-lg font-semibold text-slate-800">
              {result.monthlyRatePerSqm.toFixed(1)} <span className="text-xs font-normal">원</span>
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">기간 내 총 적립 목표</p>
            <p className="text-lg font-semibold text-slate-800">
              {(result.periodTargetAmount / 100000000).toFixed(2)} <span className="text-xs font-normal">억원</span>
            </p>
          </div>
        </div>

        <div className="h-48 w-full mt-4 relative">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${Math.round(value).toLocaleString()}원`} />
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-xs text-slate-400">납부 비중</span>
             </div>
        </div>

        <div className="flex gap-2" data-html2canvas-ignore="true">
          <button
            onClick={onConsultAI}
            disabled={isAiLoading}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-medium ${
              isAiLoading 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isAiLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                분석 중...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI 분석 요청
              </>
            )}
          </button>
          
          <button
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="px-4 py-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-medium text-sm flex items-center gap-2"
          >
             {isPdfGenerating ? '저장 중...' : (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PDF 저장
               </>
             )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;