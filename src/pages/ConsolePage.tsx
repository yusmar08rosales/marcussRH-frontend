const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Zap } from 'react-feather';
import { Button } from '../components/button/Button';

import './ConsolePage.scss';
import axios from 'axios';
import { data, useNavigate, useParams } from "react-router-dom";

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function ConsolePage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
    prompt('OpenAI API Key') ||
    '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  const { id } = useParams(); //id para ruta
  const navigate = useNavigate();
  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
          apiKey: apiKey,
          dangerouslyAllowAPIKeyInBrowser: true,
        }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [isConversationEnded, setIsConversationEnded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [report, setReport] = useState<string | null>(null); // Estado para el informe
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [informes, setInformes] = useState([]);
  
  // Función para generar el informe con la transcripción
  const generateReport = async (transcription: string) => {
    const prompt = `Genera un informe de esta conversación de entrevista de trabajo: \n${transcription} para ver si califica para el cargo y al final puntualo del 1/10`;

    try {
      console.log("Prompt enviado a OpenAI:", prompt);

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer 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`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Respuesta completa de OpenAI:", response.data);

      if (response.data) {
        let finalResult;
        const generatedReport = response.data.choices[0].message.content;
        console.log("Informe generado:", generatedReport);

        const regex = /(\d+)\/10/;
        // Buscar coincidencia
        const match = generatedReport.match(regex);
        console.log("match", match);

        if (match) {
          const formatt = match[0];
          // Expresión regular para extraer el número antes de "/"
          const regex2 = /^(\d+)\//;
          // Buscar coincidencia
          const match2 = formatt.match(regex2);

          if (match2) {
            finalResult = parseInt(match2[1], 10); // Convertir a entero
            console.log("Resultado final como número entero:", finalResult);
          } else {
            console.error("No se encontró el número antes de la barra.");
          }
        } else {
          console.error("No se encontró la puntuación en el formato esperado.");
        }

        // Guardar el informe en MongoDB
        const guardarAnalisis = await axios.post(`http://localhost:5000/guardar`, {
          id,
          analisis: generatedReport,
          transcripcion: transcription,
          calificacion: finalResult,
        });

        console.log("Informe guardado exitosamente en MongoDB", guardarAnalisis);
        return guardarAnalisis;
      }
    } catch (error) {
      console.error("Error al generar o guardar el informe:", error);
      return null;
    }
  };
  /**
  * Conectar la conversación y mostrar el video
  */
  const connectConversation = useCallback(async () => {
    try {
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      const wavStreamPlayer = wavStreamPlayerRef.current;

      setIsConversationEnded(false);
      setIsConnected(true);
      startTimeRef.current = new Date().toISOString();
      setRealtimeEvents([]);
      setItems(client.conversation.getItems());

      await wavRecorder.begin();
      await wavStreamPlayer.connect();
      await client.connect();

      // Activa el modo "En vivo"
      await enableLiveMode();

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello!`,
        },
      ]);
    } catch (error) {
      console.error("Error al conectar la conversación o iniciar el avatar:", error);
    }
  }, []);

  /**
   * Desconectar la conversación y mostrar el video
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();

    // Generar transcripción completa
    const fullTranscription = items
      .map((item) => item.formatted.transcript)
      .filter(Boolean)
      .join('\n');

    const generatedReport = await generateReport(fullTranscription);
    
    if (generatedReport) {
      console.log('Informe generado y guardado:', generatedReport);
    }

    setIsConversationEnded(true); // Mostrar video de despedida
    navigate(`/entrevista/fin/${id}`, {
    state: {
      id,
      fullTranscription,
      generatedReport,
    },
  });
  }, [items, id, navigate]);

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const enableLiveMode = async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;

    // Configura siempre en "En vivo"
    client.updateSession({
      turn_detection: { type: 'server_vad' },
    });

    if (client.isConnected() && wavRecorder.getStatus() !== 'recording') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#A000EB',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#6FB0F0',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  const fetchInformes = async (): Promise<Informe[]> => {
    try {
      const response = await axios.get<Informe[]>(`http://localhost:5000/informes?id=${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener los informes:', error);
      throw error; // Relanza el error para manejarlo en el lugar de uso
    }
  };

  interface Informe {
    nombre: string;
    apellido: string;
    cargo_al_que_se_postula: string;
    analisis_de_su_curriculo: string;
    id?: string; // Si `id` es opcional
  }

  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    (async () => {
      try {
        const resultado = await fetchInformes();
        console.log("Resultado fuera de la promesa:", resultado);

        resultado.map((value: Informe, index: number) => {
          const objParseJson = JSON.parse(JSON.stringify(value, null, 2));
          const descripcionInformes = `nombre del Candidato: ${objParseJson.nombre} ${objParseJson.apellido}, Cargo: ${objParseJson.cargo_al_que_se_postula}, Experiencia: ${objParseJson.analisis_de_su_curriculo}`;
          const instruccionFinal = `System settings:
            Tool use: enabled.

            Instructions:${descripcionInformes}\n\n${instructions}`;
          console.log("Instrucción final para el sistema:", instruccionFinal);
          client.updateSession({ instructions: instruccionFinal });
        });

      } catch (error) {
        console.error("Error fuera de la promesa:", error);
      }
    })();
    console.log('los informes: ');
    console.log(informes);

    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Add tools
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );
    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      // Si hay una transcripción de audio, añádela al estado
      if (delta?.transcription) {
        item.formatted.transcript = delta.transcription.text;
      }

      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [id]);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/logo_seo.png" />
          <span className='titulo'>Entrevista Seo Contenidos</span>
        </div>
      </div>

      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization-image">
              <img src="emily.png" alt="Emily" />
            </div>
            <div className="visualization">

              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>

            </div>
          </div>

          <div className="content-actions">
            <div className="status">En vivo</div> {/* Indica el estado */}
            <Button
              label={isConnected ? 'Desconectar' : 'Conectar'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={isConnected ? disconnectConversation : connectConversation}
            />
          </div>
        </div>
      </div>
    </div >
  );
}
