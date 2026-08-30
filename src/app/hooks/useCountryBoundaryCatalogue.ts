import { useEffect, useRef, useState } from 'react';
import {
  loadGeneratedAdministrativeIndex,
  loadGeneratedAdministrativeShard,
  type GeneratedAdministrativeCountry,
  type GeneratedAdministrativeIndex,
  type GeneratedAdministrativeShard,
} from '../../domain/generatedAdministrativeCatalogue';

type CountryBoundaryState = Readonly<{
  catalogue: GeneratedAdministrativeIndex | null;
  country: GeneratedAdministrativeCountry | null;
  error: string;
  isLoading: boolean;
  shard: GeneratedAdministrativeShard | null;
}>;

const INITIAL_STATE: CountryBoundaryState = {
  catalogue: null,
  country: null,
  error: '',
  isLoading: true,
  shard: null,
};

export function useCountryBoundaryCatalogue() {
  const [state, setState] = useState<CountryBoundaryState>(INITIAL_STATE);
  const activeController = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  async function loadCountry(catalogue: GeneratedAdministrativeIndex, country: GeneratedAdministrativeCountry) {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setState({ catalogue, country, error: '', isLoading: true, shard: null });
    try {
      const shard = await loadGeneratedAdministrativeShard(country, catalogue.sourceVersion, controller.signal);
      if (requestId.current === currentRequest) {
        setState({ catalogue, country, error: '', isLoading: false, shard });
      }
    } catch (loadError: unknown) {
      if (!controller.signal.aborted && requestId.current === currentRequest) {
        setState({
          catalogue,
          country,
          error: `${country.name} boundaries unavailable. ${loadError instanceof Error ? loadError.message : 'Try again.'}`,
          isLoading: false,
          shard: null,
        });
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const catalogue = await loadGeneratedAdministrativeIndex(controller.signal);
        if (controller.signal.aborted) return;
        setState({ catalogue, country: null, error: '', isLoading: false, shard: null });
      } catch (loadError: unknown) {
        if (!controller.signal.aborted) {
          setState({
            catalogue: null,
            country: null,
            error: `Worldwide catalogue unavailable. Boundaries cannot be added until it is available. ${loadError instanceof Error ? loadError.message : ''}`.trim(),
            isLoading: false,
            shard: null,
          });
        }
      }
    }
    void initialize();
    return () => {
      controller.abort();
      activeController.current?.abort();
    };
  }, []);

  const selectCountry = (country: GeneratedAdministrativeCountry) => {
    const catalogue = state.catalogue;
    if (catalogue) void loadCountry(catalogue, country);
  };

  return { selectCountry, state };
}
