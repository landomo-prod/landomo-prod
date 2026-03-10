import { HabitacliaSearchConfig } from '../types/habitacliaTypes';

// All search combinations to cover all property types
export function getAllSearchConfigs(provinces: string[]): HabitacliaSearchConfig[] {
  const configs: HabitacliaSearchConfig[] = [];

  const propertyTypes: HabitacliaSearchConfig['propertyType'][] = [
    'pisos', 'casas', 'terrenos', 'locales', 'oficinas', 'naves',
  ];
  const transactionTypes: HabitacliaSearchConfig['transactionType'][] = ['comprar', 'alquiler'];

  for (const province of provinces) {
    for (const propertyType of propertyTypes) {
      for (const transactionType of transactionTypes) {
        configs.push({ propertyType, transactionType, province });
      }
    }
  }

  return configs;
}

export function getConfigLabel(config: HabitacliaSearchConfig): string {
  return `${config.transactionType}/${config.propertyType}/${config.province}`;
}
