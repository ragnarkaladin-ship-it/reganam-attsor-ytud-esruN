
import { GoogleGenAI, Type } from "@google/genai";
import { Nurse, Duty, ShiftType } from "../types";

// Fix: Strictly initialized using the named parameter as required by the documentation
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const optimizeRoster = async (nurses: Nurse[], days: string[]) => {
  const nurseList = nurses.map(n => `${n.id}: ${n.name} (Ward: ${n.ward}, Specialty: ${n.specialty})`).join(', ');
  const prompt = `Act as a senior ward manager at PCEA Tumutumu Hospital. Generate an optimized shift roster for these nurses: [${nurseList}] for the dates: [${days.join(', ')}]. 
  Rules:
  1. Shift Allocation Rules:
     - For the "Theatre" ward: Use (Morning, Afternoon, Night, Straight) shifts.
     - For ALL OTHER wards: Use ONLY (Straight, Night) shifts. DO NOT use Morning or Afternoon shifts for these wards.
  2. Each day must have at least one nurse per shift appropriate for that ward.
  3. A nurse should only be given off-duty days (LEAVE) after completing exactly 3 consecutive shifts.
  4. After 3 consecutive shifts, the nurse MUST be given 3 consecutive off-duty days (LEAVE).
  5. Nurses should not work more than 3 shifts in a row.
  6. Fair distribution of shifts across all staff.
  Return the roster as a JSON array of objects with keys: nurseId, date, shift.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nurseId: { type: Type.INTEGER },
              date: { type: Type.STRING },
              shift: { type: Type.STRING, enum: Object.values(ShiftType) }
            },
            required: ["nurseId", "date", "shift"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini optimization failed:", error);
    return null;
  }
};

export const generateSmsNotification = async (nurseName: string, date: string, shift: string) => {
  const prompt = `Write a professional and concise SMS notification for a nurse named ${nurseName} at PCEA Tumutumu Hospital informing them of a new duty assignment on ${date} for the ${shift} shift. Keep it under 160 characters.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return `PCEA Tumutumu: Duty Update - ${date} (${shift} shift). Please check the app.`;
  }
};

export const summarizeMessages = async (messages: string[]) => {
  const prompt = `Act as an administrator at PCEA Tumutumu Hospital. Summarize these staff requests into action items: \n${messages.join('\n')}`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Could not summarize messages at this time.";
  }
};
