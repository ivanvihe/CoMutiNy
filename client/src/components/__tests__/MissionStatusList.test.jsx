import { render, screen } from '@testing-library/react';
import MissionStatusList from '../MissionStatusList.jsx';

describe('MissionStatusList', () => {
  it('muestra misiones con sus estados', () => {
    const missions = [
      {
        id: 'test-1',
        title: 'Probar sensores',
        summary: 'Ejecuta diagnósticos básicos.',
        status: 'in-progress',
        objectives: ['Abrir panel', 'Ejecutar comandos'],
        rewards: ['Datos calibrados']
      },
      {
        id: 'test-2',
        title: 'Recolectar muestras',
        summary: 'Extrae fragmentos del bioma.',
        status: 'completed'
      }
    ];

    render(<MissionStatusList missions={missions} />);

    expect(screen.getByText('Probar sensores')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Recolectar muestras')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.getByText(/Recompensas/)).toHaveTextContent('Datos calibrados');
  });

  it('muestra un mensaje cuando no hay misiones', () => {
    render(<MissionStatusList missions={[]} />);
    expect(
      screen.getByText(
        'Este mapa no tiene misiones activas. Explora otros sectores o revisa el registro de eventos.'
      )
    ).toBeInTheDocument();
  });
});
