"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@chakra-ui/react";
import { Box, Text, VStack, Spinner, HStack, Code } from "@chakra-ui/react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/../amplify_outputs.json";

Amplify.configure(outputs);

const client = generateClient<Schema>();

type JobStatus = {
  status: string;
  result?: Record<string, number>;
  error?: string;
  createdAt?: string;
  completedAt?: string;
};

export default function Earthaccess() {
  const [responseData, setResponseData] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<string>("");
  const [useAsync, setUseAsync] = useState(true);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const pollJobStatus = async (jobId: string) => {
    try {
      const { data, errors } = await client.queries.getEarthAccessJobStatus({
        jobId: jobId,
      });

      if (errors) {
        setError(errors.map((e: { message: string }) => e.message).join(", "));
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
        setLoading(false);
        return;
      }

      if (data) {
        // Parse the response if it's a string
        let status: JobStatus;
        if (typeof data === 'string') {
          status = JSON.parse(data) as JobStatus;
        } else {
          status = data as unknown as JobStatus;
        }
        
        setJobStatus(status.status);

        if (status.status === "completed") {
          setResponseData(status.result || null);
          setLoading(false);
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
          }
        } else if (status.status === "failed") {
          setError(status.error || "Job failed");
          setLoading(false);
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while polling");
      setLoading(false);
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    }
  };

  const handleAsyncClick = async () => {
    setLoading(true);
    setError("");
    setResponseData(null);
    setJobStatus("starting");
    
    try {
      // Start the async job
      const { data, errors } = await client.queries.startEarthAccessJob({
        long: -122.3,
        lat: 47.6,
        date: "2025-08-01",
        timezone: "America/Los_Angeles",
      });

      if (errors) {
        setError(errors.map((e: { message: string }) => e.message).join(", "));
        setLoading(false);
      } else if (data) {
        const newJobId = data as string;
        setJobId(newJobId);
        setJobStatus("pending");
        
        // Start polling for job completion (every 3 seconds)
        pollingInterval.current = setInterval(() => {
          pollJobStatus(newJobId);
        }, 3000);
        
        // Also poll immediately
        pollJobStatus(newJobId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  const handleSyncClick = async () => {
    setLoading(true);
    setError("");
    setResponseData(null);
    setJobStatus("");
    
    try {
      const { data, errors } = await client.queries.earthaccess({
        long: -122.3,
        lat: 47.6,
        date: "2025-08-01",
        timezone: "America/Los_Angeles",
      });

      if (errors) {
        setError(errors.map((e: { message: string }) => e.message).join(", "));
      } else if (data) {
        // Parse the response from the sync endpoint
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const message = parsed?.message || parsed;
        setResponseData(message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={8}
    >
      <VStack gap={6} align="center" maxW="800px" w="full">
        <Text fontSize="2xl" fontWeight="bold">
          Earth Access Data Fetcher
        </Text>

        <HStack gap={4}>
          <Button
            onClick={() => setUseAsync(true)}
            variant={useAsync ? "solid" : "outline"}
            colorPalette="blue"
          >
            Async Mode (5 years)
          </Button>
          <Button
            onClick={() => setUseAsync(false)}
            variant={!useAsync ? "solid" : "outline"}
            colorPalette="green"
          >
            Sync Mode (2 years)
          </Button>
        </HStack>

        <Button
          onClick={useAsync ? handleAsyncClick : handleSyncClick}
          colorPalette={useAsync ? "blue" : "green"}
          size="lg"
          px={8}
          py={6}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" /> : useAsync ? "Start Async Job" : "Fetch Data (Sync)"}
        </Button>

        {jobId && useAsync && (
          <Box
            p={4}
            bg="blue.50"
            borderRadius="md"
            w="full"
            textAlign="center"
            _dark={{ bg: "blue.950" }}
          >
            <Text fontSize="sm" fontWeight="bold" mb={2}>Job ID:</Text>
            <Code fontSize="xs">{jobId}</Code>
            <Text fontSize="sm" fontWeight="bold" mt={3} mb={1}>Status:</Text>
            <Text fontSize="md" color="blue.600" _dark={{ color: "blue.300" }}>
              {jobStatus}
            </Text>
          </Box>
        )}

        {error && (
          <Box
            p={6}
            bg="red.100"
            borderRadius="md"
            w="full"
            textAlign="center"
            _dark={{ bg: "red.900" }}
          >
            <Text fontSize="lg" color="red.700" _dark={{ color: "red.200" }}>
              Error: {error}
            </Text>
          </Box>
        )}

        {responseData && !error && (
          <Box
            p={6}
            bg="gray.100"
            borderRadius="md"
            w="full"
            _dark={{ bg: "gray.800" }}
          >
            <Text fontSize="lg" fontWeight="bold" mb={4}>
              Results (Noon Values):
            </Text>
            <VStack gap={2} align="stretch">
              {Object.entries(responseData).map(([key, value]) => (
                <HStack key={key} justify="space-between">
                  <Text fontWeight="medium">{key}:</Text>
                  <Code>{typeof value === 'number' ? value.toFixed(4) : value}</Code>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}

        <Box
          p={4}
          bg="gray.50"
          borderRadius="md"
          w="full"
          fontSize="sm"
          _dark={{ bg: "gray.900" }}
        >
          <Text fontWeight="bold" mb={2}>ℹ️ Mode Information:</Text>
          <Text mb={1}>
            <strong>Async Mode:</strong> Fetches 5 years of data. Job runs in background, 
            results appear when complete (~30-60s).
          </Text>
          <Text>
            <strong>Sync Mode:</strong> Fetches 2 years of data. Returns immediately if 
            it completes within 30 seconds (may still timeout).
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

