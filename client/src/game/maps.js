export const MAPS = [
  {
    id: 'bridge',
    name: 'Puente de mando',
    biome: 'Comando',
    description:
      'La sala de control principal desde la que se coordinan rutas, comunicaciones y vigilancia de la nave.',
    size: { width: 10, height: 6 },
    spawn: { x: 4, y: 4 },
    blockedAreas: [
      { x: 0, y: 0, width: 10, height: 1 },
      { x: 0, y: 5, width: 10, height: 1 },
      { x: 0, y: 0, width: 1, height: 6 },
      { x: 9, y: 0, width: 1, height: 6 },
      // Consola central
      { x: 3, y: 2, width: 4, height: 1 }
    ],
    objects: [
      {
        id: 'nav-console',
        name: 'Consola de navegación',
        position: { x: 3, y: 1 },
        size: { width: 4, height: 1 },
        solid: true,
        interaction: {
          type: 'dialog',
          title: 'Consola de navegación',
          description:
            'Las coordenadas están bloqueadas para evitar otra mutinería... pero quizá alguien con el rol adecuado pueda cambiarlas.',
          missionUpdates: [
            {
              missionId: 'course-relock',
              status: 'in-progress',
              log: 'Se desbloquearon los controles de rumbo para revisar la trayectoria.'
            }
          ]
        }
      },
      {
        id: 'captains-chair',
        name: 'Silla del capitán',
        position: { x: 5, y: 3 },
        size: { width: 1, height: 1 },
        solid: false,
        interaction: {
          type: 'status',
          title: 'Silla del capitán',
          description: 'Te sientas por un momento. Sientes el peso de la responsabilidad sobre tus hombros.'
        }
      },
      {
        id: 'sensor-array',
        name: 'Matriz de sensores',
        position: { x: 1, y: 3 },
        size: { width: 2, height: 1 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Diagnóstico de sensores',
          description: 'Inicias un barrido de diagnóstico para recalibrar los sensores de largo alcance.',
          missionUpdates: [
            {
              missionId: 'sensor-diagnostics',
              status: 'completed',
              log: 'Los sensores han sido recalibrados y reportan lecturas estables.'
            }
          ]
        }
      }
    ],
    portals: [
      {
        id: 'bridge-to-quarters',
        from: { x: 1, y: 1, width: 1, height: 1 },
        targetMap: 'quarters',
        targetPosition: { x: 8, y: 3 },
        description: 'Entrada hacia los camarotes.'
      },
      {
        id: 'bridge-to-hydroponics',
        from: { x: 8, y: 4, width: 1, height: 1 },
        targetMap: 'hydroponics',
        targetPosition: { x: 2, y: 5 },
        description: 'Acceso al vivero hidropónico.'
      }
    ],
    missions: [
      {
        id: 'course-relock',
        title: 'Reconfigurar el rumbo',
        summary: 'Revierte la trayectoria impuesta por la mutinería y fija coordenadas seguras.',
        status: 'available',
        objectives: [
          'Auditar los registros de salto',
          'Desbloquear la consola principal',
          'Enviar el plan de ruta aprobado'
        ],
        rewards: ['+5 reputación de puente', 'Desbloquea el laboratorio de asteroides']
      },
      {
        id: 'sensor-diagnostics',
        title: 'Diagnosticar sensores',
        summary: 'Ejecuta un barrido completo para detectar amenazas cercanas.',
        status: 'in-progress',
        objectives: ['Revisar la matriz de sensores', 'Transmitir informe al equipo de vigilancia'],
        rewards: ['Datos de vigilancia enriquecidos']
      }
    ]
  },
  {
    id: 'quarters',
    name: 'Camarotes',
    biome: 'Habitacional',
    description: 'Área de descanso y logística personal donde la tripulación se reagrupa y coordina turnos.',
    size: { width: 9, height: 7 },
    spawn: { x: 1, y: 3 },
    blockedAreas: [
      { x: 0, y: 0, width: 9, height: 1 },
      { x: 0, y: 6, width: 9, height: 1 },
      { x: 0, y: 0, width: 1, height: 7 },
      { x: 8, y: 0, width: 1, height: 7 }
    ],
    objects: [
      {
        id: 'storage-locker',
        name: 'Taquilla de suministros',
        position: { x: 2, y: 2 },
        size: { width: 1, height: 2 },
        solid: true,
        interaction: {
          type: 'inventory',
          title: 'Taquilla de suministros',
          description: 'Encuentras uniformes de repuesto y una caja con componentes electrónicos.',
          missionUpdates: [
            {
              missionId: 'inventory-pass',
              status: 'completed',
              log: 'El inventario quedó registrado y actualizado para toda la tripulación.'
            }
          ]
        }
      },
      {
        id: 'bunk-bed',
        name: 'Literas',
        position: { x: 5, y: 2 },
        size: { width: 2, height: 2 },
        solid: true,
        interaction: {
          type: 'rest',
          title: 'Literas',
          description: 'Los colchones son sorprendentemente cómodos. Recuperas tu energía mental.'
        }
      },
      {
        id: 'tactical-briefing',
        name: 'Pizarra táctica',
        position: { x: 6, y: 4 },
        size: { width: 2, height: 1 },
        solid: false,
        interaction: {
          type: 'mission',
          title: 'Coordinación de turnos',
          description: 'Coordina los relevos y asigna responsables para vigilar los nuevos biomas.',
          missionUpdates: [
            {
              missionId: 'shift-rotation',
              status: 'in-progress',
              log: 'Se organizó un turno de guardia para cubrir la bahía de motores.'
            }
          ]
        }
      }
    ],
    portals: [
      {
        id: 'quarters-to-bridge',
        from: { x: 7, y: 3, width: 1, height: 1 },
        targetMap: 'bridge',
        targetPosition: { x: 2, y: 1 },
        description: 'Corredor hacia el puente de mando.'
      },
      {
        id: 'quarters-to-engine',
        from: { x: 1, y: 5, width: 1, height: 1 },
        targetMap: 'engine-bay',
        targetPosition: { x: 6, y: 2 },
        description: 'Montacargas hacia la bahía de motores.'
      }
    ],
    missions: [
      {
        id: 'inventory-pass',
        title: 'Organizar inventario',
        summary: 'Clasifica suministros personales y comparte recursos con la tripulación.',
        status: 'available',
        objectives: ['Registrar taquillas', 'Emitir informe de suministros'],
        rewards: ['Desbloquea recursos para otras misiones']
      },
      {
        id: 'shift-rotation',
        title: 'Coordinar turnos',
        summary: 'Planifica un horario compartido para vigilar cada sector crítico.',
        status: 'available',
        objectives: ['Revisar solicitudes', 'Publicar el plan en la pizarra táctica'],
        rewards: ['Moral de tripulación +3']
      }
    ]
  },
  {
    id: 'hydroponics',
    name: 'Vivero Hidropónico',
    biome: 'Biológico',
    description:
      'Cubierta verde llena de estanques de nutrientes, luces crecidas y drones polinizadores en suspenso.',
    size: { width: 12, height: 8 },
    spawn: { x: 2, y: 5 },
    blockedAreas: [
      { x: 0, y: 0, width: 12, height: 1 },
      { x: 0, y: 7, width: 12, height: 1 },
      { x: 0, y: 0, width: 1, height: 8 },
      { x: 11, y: 0, width: 1, height: 8 },
      { x: 3, y: 2, width: 6, height: 1 }
    ],
    objects: [
      {
        id: 'irrigation-panel',
        name: 'Panel de riego',
        position: { x: 4, y: 3 },
        size: { width: 2, height: 1 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Reactivar riego',
          description: 'Restableces el flujo de nutrientes y monitorizas el nivel de humedad.',
          missionUpdates: [
            {
              missionId: 'restore-irrigation',
              status: 'completed',
              log: 'Los aspersores vuelven a funcionar y las plantas recuperan su color.'
            }
          ]
        }
      },
      {
        id: 'pollination-drones',
        name: 'Estación de drones',
        position: { x: 8, y: 4 },
        size: { width: 2, height: 2 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Calibrar drones polinizadores',
          description: 'Ejecutas una calibración fina para equilibrar la distribución de polen.',
          missionUpdates: [
            {
              missionId: 'drone-calibration',
              status: 'in-progress',
              log: 'Los drones comienzan rutinas de prueba y requieren seguimiento en 4 ciclos.'
            }
          ]
        }
      },
      {
        id: 'sample-lab',
        name: 'Laboratorio botánico',
        position: { x: 2, y: 1 },
        size: { width: 2, height: 1 },
        solid: false,
        interaction: {
          type: 'dialog',
          title: 'Laboratorio botánico',
          description: 'Notas una serie de muestras luminescentes etiquetadas para el laboratorio de asteroides.'
        }
      }
    ],
    portals: [
      {
        id: 'hydroponics-to-bridge',
        from: { x: 10, y: 6, width: 1, height: 1 },
        targetMap: 'bridge',
        targetPosition: { x: 7, y: 4 },
        description: 'Pasarela hacia el puente de mando.'
      },
      {
        id: 'hydroponics-to-asteroid',
        from: { x: 9, y: 2, width: 1, height: 1 },
        targetMap: 'asteroid-research',
        targetPosition: { x: 3, y: 4 },
        description: 'Conducto presurizado hacia el laboratorio de asteroides.'
      }
    ],
    missions: [
      {
        id: 'restore-irrigation',
        title: 'Reactivar riego',
        summary: 'Reinicia el ciclo de humedad para salvar la cosecha experimental.',
        status: 'available',
        objectives: ['Inspeccionar el panel principal', 'Verificar niveles de nutrientes'],
        rewards: ['Suministro de alimentos estabilizado']
      },
      {
        id: 'drone-calibration',
        title: 'Calibrar drones polinizadores',
        summary: 'Programa rutas y sensores para asegurar la polinización pareja.',
        status: 'in-progress',
        objectives: ['Ajustar patrones de vuelo', 'Recolectar muestras de polen'],
        rewards: ['Datos para investigación botánica']
      }
    ]
  },
  {
    id: 'engine-bay',
    name: 'Bahía de motores',
    biome: 'Industrial',
    description:
      'Zona industrial llena de conductos, válvulas de plasma y pasarelas de mantenimiento del núcleo.',
    size: { width: 11, height: 7 },
    spawn: { x: 6, y: 2 },
    blockedAreas: [
      { x: 0, y: 0, width: 11, height: 1 },
      { x: 0, y: 6, width: 11, height: 1 },
      { x: 0, y: 0, width: 1, height: 7 },
      { x: 10, y: 0, width: 1, height: 7 },
      { x: 4, y: 3, width: 3, height: 1 }
    ],
    objects: [
      {
        id: 'plasma-controls',
        name: 'Control de plasma',
        position: { x: 2, y: 2 },
        size: { width: 2, height: 1 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Purga de plasma',
          description: 'Gestionas manualmente la purga para limpiar residuos del reactor.',
          missionUpdates: [
            {
              missionId: 'plasma-purge',
              status: 'in-progress',
              log: 'La purga está en marcha. Monitoriza los indicadores durante el ciclo.'
            }
          ]
        }
      },
      {
        id: 'reactor-core',
        name: 'Núcleo del reactor',
        position: { x: 7, y: 2 },
        size: { width: 2, height: 2 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Reinicio del núcleo',
          description: 'Desencadenas una secuencia de arranque seguro para el núcleo principal.',
          missionUpdates: [
            {
              missionId: 'reactor-restart',
              status: 'available',
              log: 'El reinicio requiere autorización adicional desde el puente.'
            }
          ]
        }
      },
      {
        id: 'maintenance-deck',
        name: 'Plataforma de mantenimiento',
        position: { x: 5, y: 5 },
        size: { width: 2, height: 1 },
        solid: false,
        interaction: {
          type: 'status',
          title: 'Informe técnico',
          description: 'Revisas un informe con pendientes de mantenimiento para la siguiente guardia.'
        }
      }
    ],
    portals: [
      {
        id: 'engine-to-quarters',
        from: { x: 9, y: 5, width: 1, height: 1 },
        targetMap: 'quarters',
        targetPosition: { x: 2, y: 5 },
        description: 'Ascensor hacia los camarotes.'
      },
      {
        id: 'engine-to-asteroid',
        from: { x: 3, y: 1, width: 1, height: 1 },
        targetMap: 'asteroid-research',
        targetPosition: { x: 5, y: 6 },
        description: 'Compuerta presurizada hacia el laboratorio de asteroides.'
      }
    ],
    missions: [
      {
        id: 'plasma-purge',
        title: 'Ejecutar purga de plasma',
        summary: 'Drena residuos energéticos para estabilizar los propulsores.',
        status: 'available',
        objectives: ['Abrir válvulas de alivio', 'Verificar niveles posteriores'],
        rewards: ['Propulsores estabilizados']
      },
      {
        id: 'reactor-restart',
        title: 'Reinicio de núcleo',
        summary: 'Restaura la potencia máxima tras la purga de emergencia.',
        status: 'locked',
        objectives: ['Sincronizar con el puente', 'Ejecutar la secuencia de arranque'],
        rewards: ['Acceso a laboratorios de campo']
      }
    ]
  },
  {
    id: 'asteroid-research',
    name: 'Laboratorio de asteroides',
    biome: 'Exoplanetario',
    description:
      'Laboratorio modular con muestras cristalinas y equipos que simulan atmósferas de asteroides.',
    size: { width: 10, height: 8 },
    spawn: { x: 3, y: 4 },
    blockedAreas: [
      { x: 0, y: 0, width: 10, height: 1 },
      { x: 0, y: 7, width: 10, height: 1 },
      { x: 0, y: 0, width: 1, height: 8 },
      { x: 9, y: 0, width: 1, height: 8 },
      { x: 4, y: 3, width: 2, height: 1 }
    ],
    objects: [
      {
        id: 'biome-scanner',
        name: 'Escáner de bioma',
        position: { x: 2, y: 2 },
        size: { width: 2, height: 1 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Cartografiar bioma',
          description: 'Escaneas fragmentos para generar un mapa 3D del asteroide.',
          missionUpdates: [
            {
              missionId: 'map-biome',
              status: 'completed',
              log: 'La cartografía revela cavernas aptas para bases avanzadas.'
            }
          ]
        }
      },
      {
        id: 'crystal-array',
        name: 'Matriz cristalina',
        position: { x: 6, y: 4 },
        size: { width: 2, height: 2 },
        solid: true,
        interaction: {
          type: 'mission',
          title: 'Extraer muestras cristalinas',
          description: 'Usas taladros de precisión para obtener fragmentos sin contaminar.',
          missionUpdates: [
            {
              missionId: 'sample-extraction',
              status: 'in-progress',
              log: 'Las muestras están aseguradas y listas para transporte controlado.'
            }
          ]
        }
      },
      {
        id: 'analysis-terminal',
        name: 'Terminal de análisis',
        position: { x: 7, y: 2 },
        size: { width: 2, height: 1 },
        solid: false,
        interaction: {
          type: 'dialog',
          title: 'Terminal de análisis',
          description: 'Sincronizas los datos del escáner con el laboratorio central.'
        }
      }
    ],
    portals: [
      {
        id: 'asteroid-to-hydroponics',
        from: { x: 1, y: 6, width: 1, height: 1 },
        targetMap: 'hydroponics',
        targetPosition: { x: 9, y: 3 },
        description: 'Túnel presurizado de regreso al vivero hidropónico.'
      },
      {
        id: 'asteroid-to-engine',
        from: { x: 8, y: 1, width: 1, height: 1 },
        targetMap: 'engine-bay',
        targetPosition: { x: 4, y: 5 },
        description: 'Elevador de servicio hacia la bahía de motores.'
      }
    ],
    missions: [
      {
        id: 'map-biome',
        title: 'Cartografiar bioma',
        summary: 'Escanea el bioma cristalino para planificar nuevas rutas mineras.',
        status: 'available',
        objectives: ['Activar el escáner de bioma', 'Compartir datos con el puente'],
        rewards: ['Rutas de navegación adicionales']
      },
      {
        id: 'sample-extraction',
        title: 'Extraer muestras cristalinas',
        summary: 'Obtén fragmentos puros para estudios energéticos.',
        status: 'locked',
        objectives: ['Preparar equipo de extracción', 'Transportar muestras al laboratorio central'],
        rewards: ['Materiales raros para mejoras de nave']
      }
    ]
  }
];
