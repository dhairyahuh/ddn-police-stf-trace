import React, { useState, useMemo } from 'react';
import {
  Table,
  Input,
  Button,
  FormGroup,
  Label,
  Pagination,
  PaginationItem,
  PaginationLink,
} from 'reactstrap';

const DataTable = ({
  data,
  columns,
  pageSize = 20,
  searchable = true,
  sortable = true,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;

    return data.filter(row =>
      columns.some(col => {
        const value = row[col.key];
        return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
      })
    );
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortable) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;

      const comparison = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection, sortable]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (columnKey) => {
    if (!sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortColumn !== columnKey) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div>
      {/* Search */}
      {searchable && (
        <FormGroup className="mb-3">
          <Label>Search</Label>
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search..."
          />
        </FormGroup>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <Table responsive hover>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    cursor: sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.header}
                  {sortable && (
                    <span className="ml-2">{getSortIcon(col.key)}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <tr key={index}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
            {sortedData.length} entries
          </div>
          <Pagination>
            <PaginationItem disabled={currentPage === 1}>
              <PaginationLink
                previous
                onClick={() => setCurrentPage(currentPage - 1)}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                page =>
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
              )
              .map((page, index, array) => (
                <React.Fragment key={page}>
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <PaginationItem disabled>
                      <PaginationLink>...</PaginationLink>
                    </PaginationItem>
                  )}
                  <PaginationItem active={currentPage === page}>
                    <PaginationLink onClick={() => setCurrentPage(page)}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                </React.Fragment>
              ))}
            <PaginationItem disabled={currentPage === totalPages}>
              <PaginationLink
                next
                onClick={() => setCurrentPage(currentPage + 1)}
              />
            </PaginationItem>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default DataTable;

