const API_BASE_URL = 'http://localhost:5000/v1';

/**
 * Sends chat history and user message to the local LLM backend.
 * @param {Array} history - Array of message objects {role, text}.
 * @param {string} userMessage - The new user message.
 * @returns {Promise<string>} - The model's text response.
 */
export const chatCompletion = async (history, userMessage) => {
    try {
        const messages = history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.text
        }));

        messages.push({ role: 'user', content: userMessage });

        // Add system instruction if needed, though backend often handles this via system prompt.
        // For now, we assume backend sets the system persona.

        const response = await fetch(`${API_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages,
                model: "local-model" // Model name might be ignored by some local servers or specific
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "I'm having trouble thinking right now.";
    } catch (error) {
        console.error("Chat API Error:", error);
        return "Sorry, I couldn't connect to my brain. Please check if the local backend is running.";
    }
};

/**
 * Sends an audio blob to the Whisper backend for transcription.
 * @param {Blob} audioBlob - The recorded audio blob (wav/webm).
 * @returns {Promise<string>} - The transcribed text.
 */
export const transcribeAudio = async (audioBlob) => {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob);

        const response = await fetch(`${API_BASE_URL}/audio/transcriptions`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`STT Error: ${response.status}`);
        const data = await response.json();
        return data.text || "";
    } catch (error) {
        console.error("STT API Error:", error);
        throw error;
    }
};

/**
 * Sends text to the Piper TTS backend and returns an audio URL.
 * @param {string} text - Text to speak.
 * @returns {Promise<Blob>} - The audio blob.
 */
export const synthesizeSpeech = async (text) => {
    try {
        const response = await fetch(`${API_BASE_URL}/audio/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: text })
        });

        if (!response.ok) throw new Error(`TTS Error: ${response.status}`);
        return await response.blob();
    } catch (error) {
        console.error("TTS API Error:", error);
        throw error;
    }
};
