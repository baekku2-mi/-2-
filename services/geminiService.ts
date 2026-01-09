import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInputs, CalculationResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing provided in process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

export const getFinancialAdvice = async (
  inputs: CalculationInputs,
  result: CalculationResult
): Promise<string> => {
  try {
    const ai = getClient();
    
    let inputDescription = '';
    
    if (inputs.mode === 'RATE') {
        inputDescription = `
        [입력 데이터 - 요율 방식]
        - 계획 기간 전체 수선비 총액: ${inputs.totalRepairCost.toLocaleString()}원
        - 해당 기간 적립 요율: ${inputs.accumulationRate}%
        `;
    } else {
        inputDescription = `
        [입력 데이터 - 금액 방식]
        - 해당 기간 적립 목표 금액: ${inputs.periodAmount.toLocaleString()}원
        `;
    }

    let periodDescription = `${inputs.durationMonths}개월`;
    if (inputs.periodInputMode === 'RANGE' && inputs.startYear && inputs.endYear) {
      periodDescription = `${inputs.startYear}년 ~ ${inputs.endYear}년 (${inputs.durationMonths}개월간)`;
    }

    const prompt = `
      당신은 대한민국 아파트 관리비 및 장기수선충당금 전문가입니다.
      사용자가 다음과 같은 조건으로 장기수선충당금을 계산했습니다.
      
      ${inputDescription}
      [공통 입력 데이터]
      - 적립 적용 기간: ${periodDescription}
      - 단지 총 면적: ${inputs.totalComplexArea.toLocaleString()}m²
      - 우리 집 면적: ${inputs.householdArea}m²
      
      [계산 결과]
      - m²당 단가: ${Math.round(result.monthlyRatePerSqm).toLocaleString()}원
      - 세대별 월 부과 금액: ${Math.round(result.householdMonthlyFee).toLocaleString()}원
      - 이 기간 동안 단지 전체 적립 목표액: ${Math.round(result.periodTargetAmount).toLocaleString()}원

      이 결과에 대해 다음 내용을 포함하여 입주민이 이해하기 쉽게 조언해주세요:
      1. 산출된 세대별 월 부담금이 대한민국 평균적인 수준(보통 m²당 100~300원 내외이나 단지 사정에 따라 다름)과 비교해 어떤지 대략적인 뉘앙스 (정확한 통계보다는 일반론).
      2. 장기수선충당금이 왜 중요한지, 이 돈이 주로 어디에 쓰이는지(승강기, 도색, 배관 등) 간략 설명.
      3. 적립 요율이나 금액이 너무 낮거나 높을 때 발생할 수 있는 문제점.
      
      말투는 정중하고 신뢰감 있게, 핵심 내용은 불렛포인트로 정리해주세요.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Simple advice doesn't need deep thinking
      }
    });

    return response.text || "죄송합니다. 조언을 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("AI 조언을 가져오는 중 오류가 발생했습니다.");
  }
};

export const searchApartmentTotalArea = async (apartmentName: string): Promise<{ totalArea: number; householdArea: number; found: boolean; sources: { title: string; uri: string }[] }> => {
    try {
        const ai = getClient();
        const prompt = `
        Search for information about the apartment complex "${apartmentName}" in South Korea.
        
        Task 1: Find the 'Total Supply Area' (총 공급면적) or 'Management Area' (관리비 부과 면적) for the *entire complex* in square meters (m²).
        Task 2: Find a representative 'Household Supply Area' (세대 공급면적) in square meters (m²). 
                If the search query contains a specific size (e.g. "34pyeong"), use that. 
                Otherwise, pick the most common household size (e.g. 84m² is very common) found in the results.
        
        Output valid JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        totalComplexArea: {
                            type: Type.NUMBER,
                            description: "The total supply area of the entire apartment complex in m². Return 0 if not found."
                        },
                        householdArea: {
                            type: Type.NUMBER,
                            description: "The representative household supply area in m². Return 0 if not found."
                        }
                    }
                }
            }
        });

        const text = response.text || "{}";
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        // Extract sources
        const sources = groundingChunks
            .map(chunk => chunk.web ? { title: chunk.web.title || "Web Source", uri: chunk.web.uri || "" } : null)
            .filter((s): s is { title: string; uri: string } => s !== null);

        let totalArea = 0;
        let householdArea = 0;
        let found = false;

        try {
            const json = JSON.parse(text);
            if (json.totalComplexArea && typeof json.totalComplexArea === 'number') {
                totalArea = json.totalComplexArea;
            }
            if (json.householdArea && typeof json.householdArea === 'number') {
                householdArea = json.householdArea;
            }
            
            // Basic validation to assume we found something meaningful
            if (totalArea > 0 || householdArea > 0) {
                found = true;
            }
        } catch (e) {
            console.error("Failed to parse search result JSON", e);
        }

        return { totalArea, householdArea, found, sources };

    } catch (error) {
        console.error("Apartment Search Error:", error);
        return { totalArea: 0, householdArea: 0, found: false, sources: [] };
    }
}