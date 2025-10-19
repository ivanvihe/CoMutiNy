const VARIABLE_PATTERN = /\$\{([^}:]+)(?::-(.*?))?}/g;

const getVariableValue = (
  variableName: string,
  defaultValue: string | undefined,
  env: NodeJS.ProcessEnv,
): string => {
  const value = env[variableName];

  if (value !== undefined) {
    return value;
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(`Environment variable "${variableName}" is not set.`);
};

export const expandEnvPlaceholders = (
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  if (!value) {
    return value;
  }

  return value.replace(VARIABLE_PATTERN, (_, variableName: string, defaultValue?: string) =>
    getVariableValue(variableName, defaultValue, env),
  );
};
