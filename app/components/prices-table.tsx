"use client";

import { CITIES, CityName } from "@/data/Cities";
import { PRODUCTS } from "@/data/Products";
import { Trend, trends } from "@/interfaces/SellingPrice";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { MRT_Localization_ZH_HANS } from "material-react-table/locales/zh-Hans";
import { useCallback, useContext, useMemo, useState } from "react";
// import { useCookies } from "react-cookie";
import { useCookies } from "next-client-cookies";
import { PriceContext } from "../price-provider";

interface ProductPrice {
  variation: number;
  trend: string; // up arrow, down arrow, or empty
  timeDiffInMin: string; // e.g. 5分钟前
  singleProfit: number;
  lotProfit: number;
}

interface ProductRow {
  sourceCity: CityName;
  buyableCities: CityName[];
  productName: string;
  source?: ProductPrice;
  targetCity: {
    [key: CityName]: ProductPrice;
  };
}

const VariationCell = (props: any) => {
  const { renderedCellValue: value } = props;
  return (
    <span>
      {value}
      {value ? "%" : ""}
    </span>
  );
};

const VariationInput = (props: any) => {
  const { value: variation, save, cancel } = props;
  const [value, setValue] = useState(variation ?? 100);

  const onBlur = (event: any) => {
    const value = event.target.value;
    if (validate(value)) {
      save(parseInt(value));
    } else {
      cancel();
    }
  };

  const validate = (value: string) => {
    if (value.endsWith("%")) {
      value = value.slice(0, -1);
    }
    const newValue = parseInt(value);
    if (isNaN(newValue) || newValue < 70 || newValue > 130) {
      return false;
    }
    return true;
  };

  return (
    <OutlinedInput
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={onBlur}
      type="number"
      autoFocus
      size="small"
      inputProps={{
        min: 70,
        max: 130,
      }}
      sx={{
        "&": {
          fontSize: "0.7rem",
        },
        '& input[type="number"]::-webkit-inner-spin-button, & input[type="number"]::-webkit-outer-spin-button': {
          "-webkit-appearance": "none",
        },
        "& input[type=number]": {
          padding: "0.5rem",
        },
      }}
    />
  );
};

const TrendCell = (props: any) => {
  const { renderedCellValue: value } = props;
  let text,
    background = "";
  if (value === "up") {
    background = "lightgreen";
    text = "↑";
  } else if (value === "down") {
    background = "lightcoral";
    text = "↓";
  }
  return (
    <span style={{ color: "white", background, padding: "5px 10px", display: "block", textAlign: "center" }}>
      {text}
    </span>
  );
};

const TrendInput = (props: any) => {
  const { value: selected, save } = props;

  const onBlur = (event: any) => {
    save(selected);
  };

  return (
    <ToggleButtonGroup value={selected} exclusive aria-label="price trend" onBlur={onBlur} autoFocus size="small">
      {trends.map((trend) => (
        <ToggleButton
          key={"trend-input-toogle-button-" + trend}
          value={trend}
          aria-label="left aligned"
          onClick={() => save(trend)}
        >
          {trend === "up" ? <TrendingUpIcon /> : <TrendingDownIcon />}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

function MultipleSelect(props: any) {
  const { allOptions, selectedOptions, handleChange, label, name } = props;

  return (
    <FormControl sx={{ m: 1, width: "16rem" }}>
      <InputLabel
        id={"multiple-select-label-" + name}
        sx={{
          fontSize: "0.7rem",
        }}
      >
        {label}
      </InputLabel>
      <Select
        labelId={"multiple-select-label-" + name}
        id={"multiple-select-" + name}
        multiple
        value={selectedOptions}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        sx={{
          fontSize: "0.7rem",
          "& .MuiSelect-select": {
            padding: ".5rem",
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              "& li": {
                fontSize: "0.7rem",
              },
            },
          },
        }}
      >
        {allOptions.map((option: string) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

interface SelectedCities {
  sourceCities: CityName[];
  targetCities: CityName[];
}

export default function PricesTable() {
  const { prices, setPrice } = useContext(PriceContext);
  const cookies = useCookies();
  const [selectedCities, setSelectedCities] = useState<SelectedCities>(() => {
    const str = cookies.get("selectedCities");
    if (str) {
      return JSON.parse(str);
    } else {
      return { sourceCities: [CITIES[0]], targetCities: [CITIES[1]] };
    }
  });

  const updateSelectedCitiesCookieAndState = useCallback(
    (newSelectedCities: SelectedCities) => {
      const newStr = JSON.stringify(newSelectedCities);
      cookies.set("selectedCities", newStr);
      setSelectedCities(newSelectedCities);
    },
    [cookies]
  );

  const setSourceCities = useCallback(
    (selected: CityName[]) => {
      const newSelectedCities = { ...selectedCities, sourceCities: selected };
      updateSelectedCitiesCookieAndState(newSelectedCities);
    },
    [selectedCities, updateSelectedCitiesCookieAndState]
  );

  const setTargetCities = useCallback(
    (selected: CityName[]) => {
      const newSelectedCities = { ...selectedCities, targetCities: selected };
      updateSelectedCitiesCookieAndState(newSelectedCities);
    },
    [selectedCities, updateSelectedCitiesCookieAndState]
  );

  // build table rows
  const data = useMemo<ProductRow[]>(() => {
    const result: ProductRow[] = [];

    PRODUCTS.map((product): void => {
      const buyableCities: CityName[] = product.buyPrices ? Object.keys(product.buyPrices) : [];

      for (const sourceCity of buyableCities) {
        if (!selectedCities.sourceCities.includes(sourceCity)) {
          return;
        }

        const productName = product.name;
        let source;
        const targetCity: { [key: CityName]: ProductPrice } = {};

        CITIES.forEach((city) => {
          const productPrices = prices[product.name];
          if (!productPrices) {
            return;
          }

          const isBuyableCity = sourceCity === city;

          const productPriceFromApi = isBuyableCity ? productPrices.buy?.[city] : productPrices.sell?.[city]; // sell/buy is player's perspective
          if (!productPriceFromApi) {
            return;
          }

          const { variation, trend, time } = productPriceFromApi;
          const timeDiffInMin = Math.ceil((Date.now() / 1000 - time._seconds) / 60);
          let profit = 0;
          if (!isBuyableCity) {
            // a product can be bought from multiple cities, so we need to find the city with the highest profit,
            // but this will also make the calculate profit unclear which city it is from
            for (const buyCity of Object.keys(product.buyPrices)) {
              let productBuyPrice = product.buyPrices[buyCity] ?? 0;
              const buyVariation = productPrices.buy?.[buyCity]?.variation ?? 0;
              productBuyPrice = Math.round((productBuyPrice * buyVariation) / 100) * 0.92; // estimated buy price

              let productSellPrice = product.sellPrices[city] ?? 0;
              const sellVariation = productPrices.sell?.[city]?.variation ?? 0;
              productSellPrice = Math.round((productSellPrice * sellVariation) / 100) * 1.04; // estimated sell price

              const cityProfit = Math.round(productSellPrice - productBuyPrice);
              profit = Math.max(profit, cityProfit);
            }
          }
          const productPriceForTable: ProductPrice = {
            variation,
            trend,
            timeDiffInMin: timeDiffInMin + "分钟前",
            singleProfit: profit,
            lotProfit: profit * (product.buyLot?.[sourceCity] ?? 0),
          };

          if (isBuyableCity) {
            source = productPriceForTable;
          } else {
            targetCity[city] = productPriceForTable;
          }
        });

        result.push({
          sourceCity,
          buyableCities,
          productName,
          source,
          targetCity,
        });
      }
    });

    return result;
  }, [selectedCities.sourceCities, prices]);

  // build headers
  const columns = useMemo<MRT_ColumnDef<ProductRow>[]>(() => {
    const result: MRT_ColumnDef<ProductRow>[] =
      CITIES.map((city: CityName) => {
        return {
          id: city + "-group",
          header: city,
          columns: [
            // variation, trend, lastUpdated, profit
            {
              id: `targetCity-${city}-variation`,
              accessorFn: (row: ProductRow) => row.targetCity[city]?.variation,
              header: "价位",
              size: 50,
              Cell: VariationCell,
              Edit: ({ cell, column, row, table }) => {
                const cancel = () => {
                  table.setEditingCell(null);
                };
                const rowData = row.original;
                const { productName, buyableCities } = rowData;
                if (buyableCities.includes(city)) {
                  cancel();
                  return null;
                }

                const save = (newVaraition: number) => {
                  row._valuesCache[column.id] = newVaraition;
                  setPrice({ product: productName, city, variation: newVaraition, type: "sell" });
                  table.setEditingCell(null);
                };
                return <VariationInput value={cell.getValue()} save={save} cancel={cancel} />;
              },
            },
            {
              id: `targetCity-${city}-trend`,
              accessorFn: (row: ProductRow) => row.targetCity[city]?.trend,
              header: "趋势",
              size: 50,
              Cell: TrendCell,
              Edit: ({ cell, column, row, table }) => {
                const rowData = row.original;
                const { productName, buyableCities } = rowData;
                if (buyableCities.includes(city)) {
                  table.setEditingCell(null);
                  return null;
                }

                const save = (newTrend: Trend) => {
                  row._valuesCache[column.id] = newTrend;
                  setPrice({ product: productName, city, trend: newTrend, type: "sell" });
                  table.setEditingCell(null);
                };

                return <TrendInput value={cell.getValue()} save={save} />;
              },
              muiTableBodyCellProps: {
                align: "justify",
              },
            },
            {
              id: `targetCity-${city}-time`,
              accessorFn: (row: ProductRow) => row.targetCity[city]?.timeDiffInMin,
              header: "更新",
              size: 50,
              enableEditing: false,
            },
            {
              id: `targetCity-${city}-singleprofit`,
              accessorFn: (row: ProductRow) => row.targetCity[city]?.singleProfit,
              header: "单个利润",
              size: 50,
              enableEditing: false,
            },
            {
              id: `targetCity-${city}-lotprofit`,
              accessorFn: (row: ProductRow) => row.targetCity[city]?.lotProfit,
              header: "单批利润",
              size: 50,
              enableEditing: false,
            },
          ],
        } as MRT_ColumnDef<ProductRow>;
      }) ?? [];

    // highest profit group
    const highestProfitCity = (row: ProductRow) => {
      const highestProfitCity = CITIES.reduce((a, b) =>
        (row.targetCity[a]?.singleProfit ?? 0) > (row.targetCity[b]?.singleProfit ?? 0) ? a : b
      );
      return highestProfitCity;
    };

    result.unshift({
      id: "highest-profit-group",
      header: "最高利润",

      columns: [
        {
          id: "highest-profit-single",
          accessorFn: (row: ProductRow) => {
            const city = highestProfitCity(row);
            return city;
          },
          header: "单个",
          size: 50,
          enableEditing: false,
          Cell: (props: any) => {
            const { renderedCellValue: city, row } = props;
            const profit = row.original.targetCity?.[city]?.singleProfit;
            if (!city || !profit) {
              return null;
            }
            return (
              <span>
                {profit} {city}
              </span>
            );
          },
          sortingFn: (rowA, rowB, columnId) => {
            const productRow1 = rowA.original;
            const productRow2 = rowB.original;
            const city1 = highestProfitCity(productRow1);
            const city2 = highestProfitCity(productRow2);
            const profit1 = productRow1.targetCity[city1]?.singleProfit ?? 0;
            const profit2 = productRow2.targetCity[city2]?.singleProfit ?? 0;
            return profit1 - profit2;
          },
        },
        {
          id: "highest-profit-lot",
          accessorFn: (row: ProductRow) => {
            const city = highestProfitCity(row);
            return city;
          },
          header: "单批",
          size: 50,
          enableEditing: false,
          Cell: (props: any) => {
            const { renderedCellValue: city, row } = props;
            const profit = row.original.targetCity?.[city]?.lotProfit;
            if (!city || !profit) {
              return null;
            }
            return (
              <span>
                {profit} {city}
              </span>
            );
          },
          sortingFn: (rowA, rowB, columnId) => {
            const productRow1 = rowA.original;
            const productRow2 = rowB.original;
            const city1 = highestProfitCity(productRow1);
            const city2 = highestProfitCity(productRow2);
            const profit1 = productRow1.targetCity[city1]?.lotProfit ?? 0;
            const profit2 = productRow2.targetCity[city2]?.lotProfit ?? 0;
            return profit1 - profit2;
          },
        },
      ],
    });

    // source city group
    result.unshift({
      id: "source-city-group",
      header: "原产地",
      columns: [
        {
          id: "source-city",
          accessorFn: (row: ProductRow) => row.sourceCity,
          header: "城市",
          enableSorting: false,
          size: 50,
          enableEditing: false,
        },
        {
          id: "source-productName",
          accessorFn: (row: ProductRow) => row.productName,
          header: "产品",
          enableSorting: false,
          size: 50,
          enableEditing: false,
        },
        {
          id: "source-variation",
          accessorFn: (row: ProductRow) => row.source?.variation,
          header: "价位",
          size: 50,
          Cell: VariationCell,
          Edit: ({ cell, column, row, table }) => {
            const save = (newVaraition: number) => {
              row._valuesCache[column.id] = newVaraition;
              const rowData = row.original;
              const { productName, sourceCity } = rowData;
              setPrice({ product: productName, city: sourceCity, variation: newVaraition, type: "buy" });
              table.setEditingCell(null);
            };
            const cancel = () => {
              table.setEditingCell(null);
            };
            return <VariationInput value={cell.getValue()} save={save} cancel={cancel} />;
          },
        },
        {
          id: "source-trend",
          accessorFn: (row: ProductRow) => row.source?.trend,
          header: "趋势",
          size: 50,
          Cell: TrendCell,
          Edit: ({ cell, column, row, table }) => {
            const save = (newTrend: Trend) => {
              row._valuesCache[column.id] = newTrend;
              const rowData = row.original;
              const { productName, sourceCity } = rowData;
              setPrice({ product: productName, city: sourceCity, trend: newTrend, type: "buy" });
              table.setEditingCell(null);
            };

            return <TrendInput value={cell.getValue()} save={save} />;
          },
          muiTableBodyCellProps: {
            align: "justify",
          },
        },
        {
          id: "source-time",
          accessorFn: (row: ProductRow) => row.source?.timeDiffInMin,
          header: "更新",
          size: 50,
          enableEditing: false,
        },
      ],
    });

    return result;
  }, [setPrice]);

  const columnVisibility = useMemo(() => {
    const visibleCities = selectedCities.targetCities;
    const invisibleCities = CITIES.filter((city) => !visibleCities?.includes(city));
    const result: { [key: string]: boolean } = {};
    invisibleCities.forEach((city) => {
      result[city + "-group"] = false;
      result[`targetCity-${city}-variation`] = false;
      result[`targetCity-${city}-trend`] = false;
      result[`targetCity-${city}-time`] = false;
      result[`targetCity-${city}-singleprofit`] = false;
      result[`targetCity-${city}-lotprofit`] = false;
    });
    return result;
  }, [selectedCities.targetCities]);

  const renderCitySelects = useCallback(() => {
    return (
      <div>
        <MultipleSelect
          label="原产地"
          name="sourceCities"
          allOptions={CITIES}
          selectedOptions={selectedCities.sourceCities}
          handleChange={(event: any) => setSourceCities(event.target.value)}
        />
        <MultipleSelect
          label="目标城市"
          name="targetCities"
          allOptions={CITIES}
          selectedOptions={selectedCities.targetCities}
          handleChange={(event: any) => setTargetCities(event.target.value)}
        />
      </div>
    );
  }, [selectedCities.sourceCities, selectedCities.targetCities, setSourceCities, setTargetCities]);

  const table = useMaterialReactTable({
    data,
    columns,
    enableColumnPinning: true,
    enableGrouping: true,
    enableColumnDragging: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableDensityToggle: false,
    enableStickyHeader: true,
    enableColumnFilters: false,
    enableEditing: true,
    editDisplayMode: "cell",
    positionToolbarAlertBanner: "none",
    renderTopToolbarCustomActions: renderCitySelects,
    initialState: {
      expanded: true,
      grouping: ["source-city"],
      columnPinning: {
        left: ["source-city", "source-productName", "source-variation", "source-trend", "source-time"],
      },
      density: "compact",
    },
    state: {
      columnVisibility,
    },

    displayColumnDefOptions: {
      "mrt-row-expand": {
        size: 50,
      },
    },
    muiTableHeadCellProps: ({ column }) => ({
      sx: {
        fontSize: "0.7rem",
        backgroundColor: column.getIsPinned() ? "#f5f5f5" : "inherit",
        borderLeft: "1px solid rgba(224, 224, 224, 1)",
        borderRight: "1px solid rgba(224, 224, 224, 1)",
        "& .MuiBadge-root": {
          display: "none",
        },
      },
    }),
    muiTableBodyCellProps: {
      sx: {
        fontSize: "0.7rem",
        lineHeight: "0.8rem",
        borderLeft: "1px solid rgba(224, 224, 224, 1)",
        borderRight: "1px solid rgba(224, 224, 224, 1)",
      },
    },
    muiTableHeadRowProps: {
      sx: {
        "&:nth-of-type(2)": {
          top: "35px",
        },
      },
    },
    muiTablePaperProps: {
      sx: {
        height: "calc(100vh - 52px)",
      },
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: "clamp(350px, calc(100vh - 64px - 52px), 9999px)", // minus extra 52px for website header
      },
    },
    localization: MRT_Localization_ZH_HANS,
  });

  return <MaterialReactTable table={table} />;
}