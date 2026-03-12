
import { GoogleGenAI, Type } from "@google/genai";
import { Nurse, Duty, ShiftType } from "../types";

// Fix: Strictly initialized using the named parameter as required by the documentation
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const optimizeRoster = async (nurses: Nurse[], days: string[]) => {
  const nurseList = nurses.map(n => `${n.id}: ${n.name} (Ward: ${n.ward}, Specialty: ${n.specialty})`).join(', ');
  const prompt = `Act as a senior ward manager at PCEA Tumutumu Hospital. Generate an optimized shift roster for these nurses: [${nurseList}] for the dates: [${days.join(', ')}]. 
  
  Operational Constraints:
  1. Ward-Specific Shifts:
     - "Theatre" ward: Must use (Morning, Afternoon, Night, Straight) shifts.
     - ALL OTHER wards: Use ONLY (Straight, Night) shifts. DO NOT use Morning or Afternoon shifts for these wards.
  2. Staffing Levels:
     - Each day in each ward must have at least one nurse on each required shift.
     - For "Theatre", ensure coverage for Morning, Afternoon, and Night.
     - For other wards, ensure coverage for Straight and Night.
  3. Fatigue Management (The 3-3 Rule):
     - A nurse must work exactly 3 consecutive shifts (excluding LEAVE/OFF).
     - After 3 consecutive shifts, the nurse MUST be given exactly 3 consecutive off-duty days (LEAVE).
     - This cycle (3 days on, 3 days off) should be maintained as much as possible for consistency.
  4. Specialty Matching:
     - If a nurse has a specialty (e.g., ICU, Theatre), prioritize them for those specific wards if applicable.
  5. Fairness:
     - Distribute night shifts evenly among staff in the same ward.
  
  Output Format:
  Return the roster as a JSON array of objects with keys: nurseId, date, shift. 
  The 'shift' value must be one of: "Morning", "Afternoon", "Night", "Straight", "Leave".`;

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

export const predictStaffingNeeds = async (nurses: Nurse[], duties: Duty[], ward: string) => {
  const today = new Date().toISOString().split('T')[0];
  const activeToday = duties.filter(d => d.date === today && d.shift !== ShiftType.LEAVE).length;
  const totalStaff = nurses.filter(n => n.ward === ward || ward === 'All').length;
  
  const prompt = `Act as a hospital staffing analyst at PCEA Tumutumu Hospital. 
  Ward: ${ward}
  Total Registered Staff: ${totalStaff}
  Active Staff Today: ${activeToday}
  
  Based on typical hospital occupancy and these numbers, provide a 1-sentence staffing adequacy prediction and a recommendation (e.g., "Staffing is optimal", "Consider calling in 1 extra nurse for the night shift").
  Keep it professional and concise.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Staffing levels appear stable for the current shift.";
  }
};
